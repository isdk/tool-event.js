import type { Event } from 'events-ex'
import { defaultsDeep } from 'lodash-es'
import { ResClientTools } from '@isdk/tool-rpc'

import { EventName, eventPatternKey, toEventMatcher, SSE_SESSION_TOKEN_HEADER } from './utils'
import { PubSubCtx, IPubSubClientTransport, PubSubClientStream } from './transports/pubsub'

export interface EventClientFuncParams {
  event?: string | string[]
  data?: any
  act?: 'sub' | 'pub' | 'unsub' | 'init'
  listener?: (...args: any[]) => void
}

export class EventClient extends ResClientTools {
  static _pubSubTransport: IPubSubClientTransport | undefined

  static setPubSubTransport(t?: IPubSubClientTransport) {
    const apiUrl = this.apiUrl;
    if (t?.setApiRoot && apiUrl) {
      // Automatically configure the transport with the static apiUrl
      t.setApiRoot(apiUrl);
    }
    this._pubSubTransport = t;
  }
  static get pubSubTransport(): IPubSubClientTransport {
    if (!this._pubSubTransport) throw new Error('EventClient pubSubTransport not set')
    return this._pubSubTransport
  }

  _stream: PubSubClientStream | undefined
  _streamEvents: string[] | undefined

  _desiredListeners: Record<string, (data:any, ctx?: PubSubCtx)=>void> = {}
  _desiredExact: Set<string> = new Set()
  _desiredRegexes: Map<string, RegExp> = new Map()
  _activeExact: Set<string> = new Set()
  _activeRegexes: Set<string> = new Set()
  _forwardEvents: Set<string> = new Set()
  private _regexUnsupportedWarned: Set<string> = new Set()

  get clientId() {
    return this._stream?.clientId
  }

  async getEvtSource() {
    let result = this._stream
    if (!result || result.readyState === 2 /* CLOSED */) {
      result = await this.initEventStream(this._streamEvents)
    }
    return result as PubSubClientStream
  }

  get active() {
    return !!this._stream && (this._stream.readyState !== 2 /* CLOSED */)
  }

  async setActive(v : boolean) {
    if (v !== this.active) {
      if (v) {
        await this.initEventStream(this._streamEvents)
      } else if (this._stream) {
        this.close()
      }
    }
  }

  description = 'subscribe server event'

  async initEventStream(events?: string | RegExp | string[]) {
    // Normalise to a pattern list the same way `subscribe`/`unsubscribe` do:
    // a bare `RegExp` is one pattern, not something to call `.map` on.
    const patterns: (string | RegExp)[] | undefined =
      events === undefined ? undefined : Array.isArray(events) ? events : [events]
    const eventList = patterns?.map((event) => this._patternKey(event))
    if (this._stream && this._stream.readyState !== 2 /* CLOSED */) {
      if (!eventList || eventList.every((event) => this._desiredListeners.has(event))) {
        return this._stream
      } else {
        this._stream.close()
        this._activeExact.clear()
        this._activeRegexes.clear()
      }
    }
    const params = eventList ? {event: eventList} : undefined
    // Pass the relative path (this.name) to the transport.
    // The transport is responsible for combining it with the apiRoot.
    const stream = this._stream = await (this.constructor as typeof EventClient).pubSubTransport.connect(this.name!, params)
    if (stream.clientId) {
      this.fetchOptions = defaultsDeep({clientId: stream.clientId}, this.fetchOptions)
      // defaultsDeep keeps whatever id a previous session left behind. The stream owns
      // the id, so the RPC header has to follow the live session, not the first one
      // this client ever had.
      this.fetchOptions.clientId = stream.clientId
    }
    // The credential the stream would present on a reconnect goes on the RPC calls too:
    // the identity policy then resolves the control plane and the data plane to one
    // session, and `$sub`/`$publish` reach this stream without a self-reported id.
    // (The server has to read it — `credentialReader: sseCredentialReader` on the RPC
    // transport — otherwise the header is just carried and ignored.)
    // Written as a fresh copy rather than in place: `this.fetchOptions` can still be the
    // object another client of this class shares, and a stream that hands back no
    // credential must not strip one from it. Class-level headers keep merging in later
    // (`fetch` deep-merges `this.fetchOptions` over the class defaults).
    const headers = {...(this.fetchOptions?.headers ?? {})}
    if (stream.sessionToken) headers[SSE_SESSION_TOKEN_HEADER] = stream.sessionToken
    else delete headers[SSE_SESSION_TOKEN_HEADER]
    this.fetchOptions = {...(this.fetchOptions ?? {}), headers}

    this._streamEvents = eventList ?? Object.keys(this._desiredListeners)
    this._syncTransport(stream)
    return stream
  }

  private _patternKey(event: string | RegExp): string {
    return eventPatternKey(event)
  }

  private _normalizePattern(event: string | RegExp): string | RegExp {
    return toEventMatcher(event)
  }

  private _isCoveredByDesiredRegex(eventName: string): boolean {
    for (const regex of this._desiredRegexes.values()) {
      if (regex.test(eventName)) return true
    }
    return false
  }

  // A transport without `addRegExEventListener` cannot match patterns at all, so
  // the subscription is accepted by the server and never delivered locally.
  // Say so once per pattern rather than failing silently.
  private _warnRegexUnsupported(key: string, stream: PubSubClientStream) {
    if (this._regexUnsupportedWarned.has(key)) return
    this._regexUnsupportedWarned.add(key)
    console.warn(
      `EventClient: regex subscription ${key} will not be delivered — ` +
      `the ${stream.protocol ?? 'current'} transport does not implement addRegExEventListener.`
    )
  }

  private _ensureListener(pattern: string | RegExp): (data:any, ctx?: PubSubCtx)=>void {
    const key = this._patternKey(pattern)
    const existing = this._desiredListeners[key]
    if (existing) return existing
    const listener = (data:any, ctx?: PubSubCtx) => this.esListener(ctx?.event || key, data, ctx)
    this._desiredListeners[key] = listener
    return listener
  }

  private _syncTransport(stream: PubSubClientStream) {
    for (const key of [...this._activeRegexes]) {
      if (!this._desiredRegexes.has(key)) {
        const listener = this._desiredListeners[key]
        if (listener) stream.removeRegExEventListener?.(key, listener)
        this._activeRegexes.delete(key)
      }
    }

    // Drop exact listeners that are no longer desired, and the ones a regex
    // subscribed *later* already covers: an exact listener that is still active
    // alongside the regex covering it delivers that event a second time, so the
    // dedup has to run on every sync, not only when the exact is first added.
    for (const key of [...this._activeExact]) {
      if (!this._desiredExact.has(key) || this._isCoveredByDesiredRegex(key)) {
        const listener = this._desiredListeners[key]
        if (listener) stream.off(key, listener)
        this._activeExact.delete(key)
      }
    }

    for (const [key, regex] of this._desiredRegexes) {
      if (!this._activeRegexes.has(key)) {
        if (!stream.addRegExEventListener) {
          this._warnRegexUnsupported(key, stream)
          continue
        }
        const listener = this._ensureListener(key)
        stream.addRegExEventListener(regex, listener)
        this._activeRegexes.add(key)
      }
    }

    for (const key of this._desiredExact) {
      if (!this._activeExact.has(key) && !this._isCoveredByDesiredRegex(key)) {
        const listener = this._ensureListener(key)
        stream.on(key, listener)
        this._activeExact.add(key)
      }
    }
  }

  // pass server sent event to eventBus if any
  esListener(evtType: string, data: any, ctx?: PubSubCtx) {
    if (!this._forwardEvents.has(evtType)) {
      const emitter = (this as any).emit ? this : (this as any).emitter
      if (emitter && evtType) {
        if (Array.isArray(data)) emitter.emit(evtType, ...data)
        else emitter.emit(evtType, data)
      }
    }
  }

  // pass event-bus event to server
  ebListener = async function(this: Event, ...args: any[]) {
    // 如果是 backendEventable, 那么第一个参数就是 this.name
    const funcName = args[0]
    // 默认约定只有一个 data object 参数
    let data = args[1]
    const event = this.type
    const target: any = this.target
    // 如果 emit 不遵循约定，就全部参数作为 data
    if (typeof funcName !== 'string' || (data && typeof data !== 'object') || args.length > 2) {
      data = args
      // 如果第一个参数是 this.name, 那么第忽略第一个参数，再传
      if (funcName && funcName === target.name) {
        data = args.slice(1)
      }
    }

    // when receive the event from SSE, the target is no publish method.
    if (target.publish) {
      await target.publish({data, event})
    }
  }

  /**
   * subscribe server event
   * @param events
   */
  async subscribe(events: string | RegExp | string[]) {
    const patterns = (Array.isArray(events) ? events : [events]).map((event) => this._patternKey(event))
    const subPayload = Array.isArray(events) ? patterns : patterns[0]
    if (!this.active) {
      await this.initEventStream(patterns)
    }
    const result = await this.sub({event: subPayload})
    for (const key of patterns) {
      const pattern = this._normalizePattern(key)
      this._ensureListener(key)
      if (pattern instanceof RegExp) {
        this._desiredRegexes.set(key, pattern)
      } else {
        this._desiredExact.add(key)
      }
    }
    const evtSource = await this.getEvtSource()
    this._syncTransport(evtSource)
    this._streamEvents = Object.keys(this._desiredListeners)
    return result
  }

  /**
   * unsubscribe server event
   * @param events
   */
  async unsubscribe(events: string | RegExp | string[]) {
    const patterns = (Array.isArray(events) ? events : [events]).map((event) => this._patternKey(event))
    const unsubPayload = Array.isArray(events) ? patterns : patterns[0]
    const result = await this.unsub({event: unsubPayload})
    for (const key of patterns) {
      this._desiredRegexes.delete(key)
      this._desiredExact.delete(key)
    }
    const evtSource = await this.getEvtSource()
    this._syncTransport(evtSource)
    for (const key of patterns) {
      delete this._desiredListeners[key]
    }
    this._streamEvents = Object.keys(this._desiredListeners)
    return result
  }

  /**
   * forward local event(s) to server
   *
   * subscribe these local events to forward/publish to server
   *
   * Note: pls backendEventable(ClientTools or EventClient) first
   * @param events
   */
  forwardEvent(events: string|string[]) {
    if (typeof events === 'string') {
      events = [events]
    }
    for (const event of events) {
      if (!this._forwardEvents.has(event)) {
        this._forwardEvents.add(event)
        if (this.on) this.on(event, this.ebListener)
      }
    }
  }

  /**
   * unforward local event(s) to server
   *
   * unsubscribe these local events not to forward/publish to server
   *
   * Note: pls backendEventable(ClientTools or EventClient) first
   * @param events
   */
  unforwardEvent(events: string|string[]) {
    if (typeof events === 'string') {
      events = [events]
    }
    for (const event of events) {
      if (this._forwardEvents.has(event)) {
        this._forwardEvents.delete(event)
        if (this.off) this.off(event, this.ebListener)
      }
    }
  }

  async init(events: string | RegExp | string[]) {
    // close eventsource and re-init event source
    this.setActive(false)
    await this.initEventStream(events)
    if (events) {return await this.subscribe(events)}
  }

  close() {
    const stream = this._stream
    if (stream) {
      // (this.constructor as typeof EventClient).pubSubTransport.disconnect?.(this._stream)
      this._stream = undefined
      this._activeExact.clear()
      this._activeRegexes.clear()
      return stream.close()
    }
  }
}

export const eventClient = new EventClient(EventName)
