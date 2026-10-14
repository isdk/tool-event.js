import { EventSource } from './browser';
import { IPubSubClientTransport, PubSubClientStream } from './client';
import { PubSubCtx } from './base';
import { SSE_CLOSE_EVENT, type PubSubSessionCloseReason } from './close';
import { genUrlParamsStr } from './gen-url-params';
import { parseEventData } from '../../utils/sse-payload';
import { toEventMatcher } from '../../utils/event-pattern';
import {
  SSE_RESUME_LAST_EVENT_QUERY,
  SSE_SESSION_TOKEN_QUERY,
  extractSessionToken,
  extractSessionTokenFromEvent,
} from '../../utils/sse-identity';

/**
 * Server-Sent Events client transport.
 *
 * Implements the `IPubSubClientTransport` interface using the browser's
 * `EventSource` API (or the `eventsource` npm package in Node.js).
 *
 * The stream is opened as a GET request to the endpoint, with the subscription
 * list encoded in the query string. The server answers with a `welcome` event
 * carrying the session id, which the stream exposes as `clientId`.
 *
 * SSE is unidirectional: the client cannot send over this connection, so
 * `send` is not implemented and control messages go over the RPC transport.
 *
 * Reconnection: the EventSource implementation reconnects on its own, to the
 * same URL. When the server issues a resume credential in the `welcome` event,
 * this transport re-opens the stream carrying it, so the drop resumes the same
 * session — same clientId, same subscription list — instead of starting a new
 * one. Listeners registered on the stream are replayed onto the new connection.
 *
 * Server-ended sessions: SSE has no channel of its own, so a server-side
 * `session.close()` is otherwise indistinguishable from a dropped connection and
 * gets resumed. With `closeSignal: true` the client honours the `$close` frame the
 * server sends first: the stream goes CLOSED, `closeReason` reports why, and no
 * reconnect is attempted. Off by default, matching the server's `closeSignal`
 * default — an application that never enabled either keeps today's behaviour, and
 * an application event named `close` is never mistaken for a teardown.
 */
export interface SseClientPubSubTransportOptions {
  /**
   * Honour the server's `$close` frame (see {@link SSE_CLOSE_EVENT}): close the
   * stream and stop reconnecting. Default `false`. Enable it together with the
   * server's `closeSignal`.
   */
  closeSignal?: boolean;
}
const finalHasQuery = (target: string) => target.includes('?');

export class SseClientPubSubTransport implements IPubSubClientTransport {
  private apiRoot: string = '';
  private readonly closeSignal: boolean;

  constructor(options: SseClientPubSubTransportOptions = {}) {
    this.closeSignal = options.closeSignal ?? false;
  }

  setApiRoot(apiRoot: string) {
    this.apiRoot = apiRoot;
  }

  async connect(url: string, params?: any): Promise<PubSubClientStream> {
    if (!this.apiRoot && !url.startsWith('http')) {
      throw new Error('SseClientPubSubTransport requires apiRoot to be set or a full URL to be provided.');
    }
    // Resolve the endpoint: absolute URLs are used as-is, relative paths are
    // resolved against the apiRoot configured on the transport.
    const endpoint = url.startsWith('http')
      ? url
      : (this.apiRoot.endsWith('/') ? `${this.apiRoot}${url}` : `${this.apiRoot}/${url}`);

    // Params travel as one JSON blob in `p=`, the shape the server side parses.
    const qs = genUrlParamsStr(params, true);
    const finalUrl = qs ? `${endpoint}${finalHasQuery(endpoint) ? '&' : '?'}${qs}` : endpoint;

    // The session identity is issued by the server in the `welcome` event, so it
    // is not known when the stream object is created — hence the getters below.
    const state = {
      clientId: '',
      token: undefined as string | undefined,
      /** Last event id seen, reported when the stream is re-opened for resume. */
      lastEventId: undefined as string | undefined,
    };

    // EventSource cannot change the URL of a live connection and sends no headers,
    // so a resume credential has to ride in the URL of a *new* connection.
    // Everything registered on the stream is remembered here and replayed onto it.
    const exactWanted = new Map<string, Set<Function>>();
    const regexWanted = new Map<string, Set<Function>>();
    let es: EventSource = new EventSource(finalUrl);
    /** Set once the server ended the session: no reconnect, `readyState` reports CLOSED. */
    let closedByServer = false;
    let closeReason: PubSubSessionCloseReason | undefined;
    // 包装监听器映射，确保 off 能卸载（重开后需在新连接上重建）
    let wrapMap = new Map<string, Map<Function, EventListener>>();
    let _regexListenerEntries = new Map<string, {regex: RegExp; handler: (e: MessageEvent) => void; original: Function}[]>();

    // A listener is consumer code. Its exception must not escape the dispatch hook
    // below, where the EventSource implementation would report it as a failed
    // connection and end the stream for every listener on it.
    const invokeRegExHandler = (entry: { handler: (e: MessageEvent) => void }, event: MessageEvent) => {
      try {
        entry.handler(event);
      } catch (err) {
        console.warn('SseClientPubSubTransport: regex listener threw, event dropped:', err);
      }
    };

    const withCredential = (target: string) => {
      if (!state.token) return target;
      let resumeUrl = `${target}${finalHasQuery(target) ? '&' : '?'}${SSE_SESSION_TOKEN_QUERY}=${state.token}`;
      // A new EventSource cannot set the `last-event-id` header, so the resumed stream
      // reports it in the URL and the channel replays from there.
      if (state.lastEventId) resumeUrl += `&${SSE_RESUME_LAST_EVENT_QUERY}=${state.lastEventId}`;
      return resumeUrl;
    };

    const on = (event: string, listener: (data: any, ctx?: PubSubCtx) => void) => {
      const wrapped = (e: MessageEvent) => { listener(parseEventData((e as any).data), {...e, event}); };
      let inner = wrapMap.get(event);
      if (!inner) { inner = new Map(); wrapMap.set(event, inner); }
      inner.set(listener, wrapped as any);
      es.addEventListener(event, wrapped);
      let wanted = exactWanted.get(event);
      if (!wanted) { wanted = new Set(); exactWanted.set(event, wanted); }
      wanted.add(listener);
    };

    const off = (event: string, listener: (data: any, ctx?: PubSubCtx) => void) => {
      const inner = wrapMap.get(event);
      const wrapped = inner?.get(listener);
      if (wrapped) { es.removeEventListener(event, wrapped); inner!.delete(listener); }
      exactWanted.get(event)?.delete(listener);
    };

    // 在首次 await 之前安装，确保 welcome 事件不丢失
    // 保存原始 dispatchEvent，卸载时恢复
    const patchDispatch = (target: EventSource) => {
      const origDispatchEvent = target.dispatchEvent;
      target.dispatchEvent = function (event: Event) {
        const eventName = event.type;
        const seenId = (event as any).lastEventId;
        if (seenId) state.lastEventId = String(seenId);
        if (eventName && _regexListenerEntries.size > 0) {
          for (const entries of _regexListenerEntries.values()) {
            for (const entry of entries) {
              // 重置 lastIndex，避免带 /g 标志的正则跨调用状态污染
              if (entry.regex.global) entry.regex.lastIndex = 0;
              if (entry.regex.test(eventName)) invokeRegExHandler(entry, event as MessageEvent);
            }
          }
        }
        if (origDispatchEvent) return origDispatchEvent.call(this, event);
        return true;
      };
    };
    /**
     * Listen for the server's session-close notice on the current connection.
     * Registered outside `on()`: it is transport control, not an application
     * subscription, and it must survive a re-open (see {@link reattachAll}).
     */
    const attachCloseSignal = (target: EventSource) => {
      if (!this.closeSignal) return;
      target.addEventListener(SSE_CLOSE_EVENT, (e: Event) => {
        const data = parseEventData((e as MessageEvent).data);
        closeReason = data?.reason;
        closedByServer = true;
        try {
          target.close();
        } catch {
          // Already gone: the flags above are what the stream reports.
        }
      });
    };

    patchDispatch(es);
    attachCloseSignal(es);

    // 注册 welcome 监听器，在 await 之前
    const welcomePromise = new Promise<{ clientId: string; token?: string }>((resolve) => {
      const wrapped = (e: MessageEvent) => {
        const data = parseEventData((e as any).data);
        resolve({ clientId: data.clientId, token: extractSessionToken(data) });
      };
      es.addEventListener('welcome', wrapped);
    });

    const welcome = await welcomePromise;
    state.clientId = welcome.clientId;
    state.token = welcome.token;

    // 重连后 welcome 会再发一次，并带上（可能已轮换的）凭证。
    // 凭证只在续用后的连接上更新：原生重连（URL 里还没有凭证）会开出一个新会话，
    // 它的凭证不能取代手上那份——手上那份才是待续用的会话。
    let resumedWithCredential = false;
    const updateSession = (data: any) => {
      const id = data?.clientId;
      if (typeof id === 'string' && id) state.clientId = id;
      if (!resumedWithCredential) return;
      const token = extractSessionTokenFromEvent(data);
      if (token) state.token = token;
    };
    on('welcome', updateSession);

    es.addEventListener('error', () => {
      // The implementation is reconnecting to the same URL. If the server issued a
      // resume credential and this connection does not carry it, re-open with it so
      // the drop resumes the same session instead of starting a new one.
      if (closedByServer) return;
      if (resumedWithCredential || !state.token) return;
      if (es.readyState !== 0) return; // 0 CONNECTING: a reconnect is in progress
      const target = withCredential(finalUrl);
      if (target === finalUrl) return;
      resumedWithCredential = true;
      try {
        es.close();
        es = new EventSource(target);
        reattachAll();
        attachCloseSignal(es);
      } catch {
        // Fall back to the implementation's own reconnect on the original URL.
      }
    });

    const addRegExEventListener = (
      pattern: string | RegExp,
      handler: (data: any, ctx?: PubSubCtx) => void,
    ) => {
      // 统一转为 RegExp，string 形式编译一次
      const regex = toEventMatcher(pattern) as RegExp;
      const key = regex.toString();

      const wrapped = (e: MessageEvent) => {
        handler(parseEventData((e as any).data), {...e, event: e.type});
      };

      if (!_regexListenerEntries.has(key)) _regexListenerEntries.set(key, []);
      _regexListenerEntries.get(key)!.push({regex, handler: wrapped, original: handler});

      let wanted = regexWanted.get(key);
      if (!wanted) { wanted = new Set(); regexWanted.set(key, wanted); }
      wanted.add(handler);
    };

    const removeRegExEventListener = (
      pattern: string | RegExp,
      handler: (data: any, ctx?: PubSubCtx) => void,
    ) => {
      const key = (toEventMatcher(pattern) as RegExp).toString();

      const entries = _regexListenerEntries.get(key);
      if (entries) {
        const idx = entries.findIndex(e => e.original === handler);
        if (idx >= 0) {
          entries.splice(idx, 1);
          if (entries.length === 0) _regexListenerEntries.delete(key);
        }
      }
      const wanted = regexWanted.get(key);
      if (wanted) {
        wanted.delete(handler);
        if (wanted.size === 0) regexWanted.delete(key);
      }
    };

    /** Re-register everything the caller had registered, onto the current EventSource. */
    const reattachAll = () => {
      wrapMap = new Map();
      _regexListenerEntries = new Map();
      patchDispatch(es);
      attachCloseSignal(es);
      for (const [event, listeners] of exactWanted) {
        for (const listener of listeners) on(event, listener as any);
      }
      for (const [pattern, handlers] of regexWanted) {
        for (const handler of handlers) addRegExEventListener(pattern, handler as any);
      }
    };

    const stream: PubSubClientStream = {
      get clientId() { return state.clientId; },
      // The credential the stream would present on a reconnect. `EventClient` puts it on
      // the RPC calls too, so the control plane resolves this same session.
      get sessionToken() { return state.token; },
      protocol: 'sse',
      get readyState() { return closedByServer ? 2 : es.readyState; },
      get closeReason() { return closeReason; },
      on, off,
      addRegExEventListener,
      removeRegExEventListener,
      addEventListener: on,
      removeEventListener: off,
      close: () => es.close(),
    };
    return stream;
  }

  disconnect(stream: PubSubClientStream) {
    return stream.close();
  }
}
