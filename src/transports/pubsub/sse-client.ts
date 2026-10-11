import { EventSource } from 'eventsource';
import type { IPubSubClientTransport, PubSubClientStream } from './client';
import type { PubSubCtx } from './base';
import { genUrlParamsStr } from './gen-url-params';
import { parseEventData, toEventMatcher } from '../../utils';

/**
 * Client-side SSE transport.
 *
 * This is an environment-agnostic adapter over the `EventSource` from the
 * `eventsource` package, which is declared as a **peer dependency** of this
 * package: it is isomorphic (browsers and Node.js alike), so nothing has to
 * install anything on `globalThis.EventSource` and the same implementation runs
 * in every environment. Consumers only need `eventsource` installed, which
 * package managers do for peer dependencies automatically.
 *
 * Regex subscriptions work because that implementation routes dispatch through
 * the JS-visible `dispatchEvent` — unlike a browser's built-in `EventSource`,
 * which dispatches internally and would never reach this hook.
 */
export class SseClientPubSubTransport implements IPubSubClientTransport {
  private apiRoot: string = '';

  setApiRoot(apiRoot: string) {
    this.apiRoot = apiRoot;
  }

  async connect(url: string, params?: any) {
    if (!this.apiRoot && !url.startsWith('http')) {
      throw new Error('SseClientPubSubTransport requires apiRoot to be set or a full URL to be provided.');
    }

    // Combine params with the new clientId
    const connectParams = {
      ...params,
    };

    // url can be a full URL or a path relative to apiRoot
    let finalUrl = url.startsWith('http') ? url : (this.apiRoot.endsWith('/') ? `${this.apiRoot}${url}` : `${this.apiRoot}/${url}`);

    if (connectParams) {
      const qs = genUrlParamsStr(connectParams as any, true);
      if (qs) {
        finalUrl += (finalUrl.includes('?') ? '&' : '?') + qs;
      }
    }
    const es = new EventSource(finalUrl);
    const welcome = new Promise<{ clientId: string }>((resolve) => {
      const handle = (e) => {
        es.removeEventListener('welcome', handle);
        resolve(parseEventData((e as any).data));
      };
      es.addEventListener('welcome', handle);
    });
    const clientId = (await welcome).clientId;

    // 包装监听器映射，确保 off 能卸载
    const wrapMap = new Map<string, Map<Function, EventListener>>();

    const on = (event: string, listener: (data: any, ctx?: PubSubCtx) => void) => {
      const wrapped = (e: MessageEvent) => {
        listener(parseEventData((e as any).data), {...e, event});
      };
      let inner = wrapMap.get(event);
      if (!inner) { inner = new Map(); wrapMap.set(event, inner); }
      // 缓存 wrapped 以便 off
      inner.set(listener, wrapped as any);
      es.addEventListener(event, wrapped);
    };

    const off = (event: string, listener: (msg: PubSubCtx) => void) => {
      const inner = wrapMap.get(event);
      const wrapped = inner?.get(listener);
      if (wrapped) {
        es.removeEventListener(event, wrapped);
        inner!.delete(listener);
      }
    };

    // ── Regex/pattern event listeners ──────────────────────────────
    // Matching happens here, but it can only see an event if the EventSource
    // implementation routes dispatch through the JS-visible `dispatchEvent`.
    // The `eventsource` package we import above does; a browser's built-in
    // EventSource does not, and it is never used here — which is why this
    // transport depends on the package rather than on the global.
    //
    // Note: `EventSource` here is the import from the `eventsource` peer
    // dependency, not the global — the built-in browser class is never used.
    // We do NOT suppress origDispatchEvent here even when a regex matches.
    // The transport delivers events to ALL registered listeners (both regex and exact).
    // Deduplication is handled upstream by EventClient.subscribe(), which decides
    // which listeners to register on the transport.
    const _regexListenerEntries = new Map<string, {regex: RegExp; handler: (e: MessageEvent) => void; original: Function}[]>();

    // A listener is consumer code. Its exception must not escape the dispatch
    // hook below, where the EventSource implementation would report it as a
    // failed connection and end the stream for every listener on it.
    const invokeRegExHandler = (entry: {regex: RegExp; handler: (e: MessageEvent) => void}, event: MessageEvent) => {
      try {
        entry.handler(event);
      } catch (err) {
        console.warn('SseClientPubSubTransport: regex listener threw, event dropped:', err);
      }
    };

    // The implementation's own dispatch, captured before we replace it. For an
    // `EventSource` that keeps exact listeners in the standard `EventTarget`
    // registry (the upstream `eventsource` class, a browser's native one), this
    // is the inherited `EventTarget.dispatchEvent` and must still be called so
    // `addEventListener` listeners keep firing. `EventSource.prototype` is only
    // ever `Function.prototype`, so the method has to be read from the instance.
    const origDispatchEvent = es.dispatchEvent;
    es.dispatchEvent = function(event: Event) {
      const eventName = event.type;

      // 1. Match regex listeners first (wildcard/regex patterns)
      if (eventName && _regexListenerEntries.size > 0) {
        for (const [, entries] of _regexListenerEntries) {
          for (const entry of entries) {
            if (entry.regex.test(eventName)) {
              invokeRegExHandler(entry, event as MessageEvent);
            }
          }
        }
      }

      // 2. Hand the event to the implementation's own dispatch (exact listeners)
      //    Always called regardless of regex match — dedup is handled by EventClient.
      if (origDispatchEvent) {
        return origDispatchEvent.call(this, event);
      }
      return true;
    };

    const addRegExEventListener = (
      pattern: string | RegExp,
      handler: (data: any, ctx?: PubSubCtx) => void,
    ) => {
      // Matching uses a stateless copy: `test()` on a /g/ or /y/ regex advances
      // `lastIndex`, which would deliver every other matching event.
      const regex = toEventMatcher(pattern) as RegExp;
      const key = regex.toString();

      const wrapped = (e: MessageEvent) => {
        handler(parseEventData((e as any).data), {...e, event: e.type});
      };

      if (!_regexListenerEntries.has(key)) _regexListenerEntries.set(key, []);
      _regexListenerEntries.get(key)!.push({regex, handler: wrapped, original: handler});
    };

    const removeRegExEventListener = (
      pattern: string | RegExp,
      handler: (data: any, ctx?: PubSubCtx) => void,
    ) => {
      const key = (toEventMatcher(pattern) as RegExp).toString();

      const entries = _regexListenerEntries.get(key);
      if (!entries) return;
      const idx = entries.findIndex(e => e.original === handler);
      if (idx >= 0) {
        entries.splice(idx, 1);
        if (entries.length === 0) _regexListenerEntries.delete(key);
      }
    };

    const stream: PubSubClientStream = {
      clientId,
      protocol: 'sse',
      get readyState() { return es.readyState; },
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
