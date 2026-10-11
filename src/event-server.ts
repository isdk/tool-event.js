import { EventName, EventBusName, eventPatternKey, toEventMatcher } from './utils';
import { event } from './event'
import { type ServerFuncParams, type ToolRpcContext } from '@isdk/tool-rpc';
import type { Event } from 'events-ex';
import { ResServerTools } from '@isdk/tool-rpc';
import { ErrorCode, throwError } from '@isdk/common-error';
import type { IPubSubServerTransport } from './transports/pubsub/server';

// the singleton instance of event-bus
const eventBus = event.runSync()

/** What one EventServer class has asked to forward, and what is installed. */
type ForwardState = {
  desiredExact: Set<string>
  desiredRegexes: Map<string, RegExp>
  activeExact: Set<string>
  activeRegexes: Map<string, RegExp>
  boundListener?: (this: Event, ...data: any[]) => any
}

// One registry per class. `forward()` installs the event-bus listener on
// `this.constructor`, so the bookkeeping has to be per class as well: static
// fields declared on `EventServer` are inherited by every subclass, which let
// one instance's `unforward()` unregister the events another instance forwards.
const forwardStates = new WeakMap<object, ForwardState>()

export const ClientEventPrefix = 'client:'

export interface EventServerFuncParams {
  event?: string | string[]
  data?: any
  act?: 'sub' | 'pub' | 'unsub'
  clientId?: string
}

export class EventServer extends ResServerTools {
  enableLegacyCompat = false;

  /**
   * Controls whether the client-published events are auto-emitted on server's localBus.
   * Defaults to false for security. Must be explicitly enabled for 'client:' prefixed events to be emitted.
   */
  public static autoInjectToLocalBus = false;

  /** The forwarding registry of *this* class (subclasses get their own). */
  private static _forwardState(): ForwardState {
    const ctor = this as unknown as object
    let state = forwardStates.get(ctor)
    if (!state) {
      state = {
        desiredExact: new Set<string>(),
        desiredRegexes: new Map<string, RegExp>(),
        activeExact: new Set<string>(),
        activeRegexes: new Map<string, RegExp>(),
      }
      forwardStates.set(ctor, state)
    }
    return state
  }

  /** The event-bus listener this class forwards with. Kept as a name alias for
   *  the per-class forward state. */
  static get _boundEbListener() {
    return this._forwardState().boundListener
  }

  static _pubSubTransport: IPubSubServerTransport | undefined
  static setPubSubTransport(t?: IPubSubServerTransport) { this._pubSubTransport = t }
  static get pubSubTransport() {
    if (!this._pubSubTransport) {
      // keep compatibility 兼容的话就设置
      // this._pubSubTransport = new SSEChannel()
      // throw new Error('EventServer pubSubTransport not set')
      console.warn('EventServer pubSubTransport not set')
    }
    return this._pubSubTransport
  }

  description = 'subscribe server event'
  result = 'event'
  depends = { [EventBusName]: event }

  get pubSubTransport() {
    return (this.constructor as typeof EventServer).pubSubTransport
  }

  static publish(event: string, data: any, target?: {
    clientId?: string | string[]}) {
    return this.pubSubTransport?.publish(event, data, target)
  }

  // the local event-bus listener to forward to the transport
  static ebListener(eventType: string,...data: any[]) {
    this.pubSubTransport?.publish(eventType, data)
  }

  static _patternKey(event: string | RegExp): string {
    return eventPatternKey(event)
  }

  static _normalizePattern(event: string | RegExp): string | RegExp {
    return toEventMatcher(event)
  }

  static _isCoveredByDesiredRegex(eventName: string, state: ForwardState): boolean {
    for (const regex of state.desiredRegexes.values()) {
      if (regex.test(eventName)) return true
    }
    return false
  }

  static _syncForwards() {
    const state = this._forwardState()
    const listener = state.boundListener
    if (!listener) return

    for (const key of [...state.activeRegexes.keys()]) {
      if (!state.desiredRegexes.has(key)) {
        const regex = state.activeRegexes.get(key)
        if (regex) eventBus.off(regex, listener)
        state.activeRegexes.delete(key)
      }
    }

    // Drop patterns this class no longer wants to forward, and the exact names a
    // regex it forwards already covers — leaving both installed publishes the
    // event twice, so the coverage check runs on every sync, not only when the
    // exact name is first added.
    for (const key of [...state.activeExact]) {
      if (!state.desiredExact.has(key) || this._isCoveredByDesiredRegex(key, state)) {
        eventBus.off(key, listener)
        state.activeExact.delete(key)
      }
    }

    for (const [key, regex] of state.desiredRegexes) {
      if (!state.activeRegexes.has(key)) {
        eventBus.on(regex, listener)
        state.activeRegexes.set(key, regex)
      }
    }

    for (const key of state.desiredExact) {
      if (!state.activeExact.has(key) && !this._isCoveredByDesiredRegex(key, state)) {
        eventBus.on(key, listener)
        state.activeExact.add(key)
      }
    }
  }

  static alreadyForward(event: string | RegExp) {
    const state = this._forwardState()
    const key = EventServer._patternKey(event)
    const pattern = EventServer._normalizePattern(event)
    if (pattern instanceof RegExp) {
      return state.desiredRegexes.has(key)
    }
    return state.desiredExact.has(key) || this._isCoveredByDesiredRegex(key, state)
  }

  publishServerEvent(event: string, data: any) {
    return (this.constructor as any).publish(event, data)
  }

  // forward the events on the server event-bus to client
  forward(events: string | RegExp | string[]) {
    const list = Array.isArray(events) ? events : [events]
    const ctor = this.constructor as typeof EventServer
    const state = ctor._forwardState()
    if (!state.boundListener) {
      state.boundListener = function _ebListener(this: Event, ...data: any[]) {
        return ctor.ebListener(this.type!, ...data)
      }
    }
    for (const event of list) {
      const key = EventServer._patternKey(event)
      const pattern = EventServer._normalizePattern(event)
      if (pattern instanceof RegExp) {
        state.desiredRegexes.set(key, pattern)
      } else {
        state.desiredExact.add(key)
      }
    }
    // Sync on the class the listener was installed on. Syncing on the base class
    // finds no listener there and registers nothing, which made `forward()` a
    // silent no-op for every subclass.
    ctor._syncForwards()
  }

  unforward(events: string | RegExp | string[]) {
    const list = Array.isArray(events) ? events : [events]
    const ctor = this.constructor as typeof EventServer
    const state = ctor._forwardState()
    for (const event of list) {
      const key = EventServer._patternKey(event)
      const pattern = EventServer._normalizePattern(event)
      if (pattern instanceof RegExp) {
        state.desiredRegexes.delete(key)
      } else {
        state.desiredExact.delete(key)
      }
    }
    ctor._syncForwards()
  }

  list(params: EventServerFuncParams, context?: ToolRpcContext) {
    if (this.pubSubTransport) {
      const ctx = context || this.ctx;
      const req = ctx?.req;
      const res = ctx?.reply;
      return this.pubSubTransport.connect({ req, res, events: params.event as string[] })
    } else {
      throwError('PubSub transport not available', 'list', ErrorCode.NotImplemented)
    }
  }

  $sub(params: EventServerFuncParams, context?: ToolRpcContext) {
    if (!this.pubSubTransport) {
      throwError('PubSub transport not available', 'sub', ErrorCode.NotImplemented);
    }

    const event = params.event;
    if (event) {
      this.forward(event);

      const ctx = context || this.ctx;
      const req = ctx?.req;
      const session = req && this.pubSubTransport.getSessionFromReq?.(req);
      if (session) {
        this.pubSubTransport.subscribe(session, Array.isArray(event) ? event : [event]);
        return { forward: true, subscribed: true, event, clientId: session.clientId };
      } else {
        if (this.pubSubTransport.getSessionFromReq) {
          console.warn('$sub: No session found for request');
        } else if (!req) {
          console.warn(`$sub: missing req`);
        } else {
          console.warn(`$sub: The ${this.pubSubTransport.name} Transport does not support dynamic subscription`);
        }
        return { forward: true, event };
      }
    } else {
      throwError('event is required', 'sub', ErrorCode.InvalidArgument);
    }
  }

  $unsub(params: EventServerFuncParams, context?: ToolRpcContext) {
    if (!this.pubSubTransport) {
      throwError('PubSub transport not available', 'unsub', ErrorCode.NotImplemented);
    }

    const event = params.event;
    if (event) {
      this.unforward(event);
      const ctx = context || this.ctx;
      const req = ctx?.req;
      const session = req && this.pubSubTransport.getSessionFromReq?.(req);

      if (session) {
        this.pubSubTransport.unsubscribe(session, Array.isArray(event) ? event : [event]);
        return { forward: false, subscribed: false, event, clientId: session.clientId };
      } else {
        if (this.pubSubTransport.getSessionFromReq) {
          console.warn('$unsub: No session found for request');
        } else if (!req) {
          console.warn(`$sub: missing req`);
        } else {
          console.warn(`$unsub: The ${this.pubSubTransport.name} Transport does not support dynamic subscription`);
        }
        return { forward: false, event };
      }
    } else {
      throwError('event is required', 'unsub', ErrorCode.InvalidArgument)
    }
  }

  $publish(params: EventServerFuncParams, context?: ToolRpcContext) {
    let events = params.event;
    const data = params.data;
    if (events && data) {
      // Get the session and clientId from the transport, not from the client payload.
      // This is a critical security measure to prevent impersonation.
      const ctx = context || this.ctx;
      const req = ctx?.req;
      const session = req && this.pubSubTransport?.getSessionFromReq?.(req);
      const senderId = session?.clientId;
      const ctor = this.constructor as typeof EventServer;

      if (typeof events === 'string') {
        events = [events]
      }
      for (const event of events) {
        // Only forward to internal bus if the feature is enabled.
        if (ctor.autoInjectToLocalBus) {
          // Emit the prefixed event on the server-side bus for internal listeners.
          // A listener for 'my-event' will NOT receive 'client:my-event'.
          eventBus.emit(ClientEventPrefix + event, data, {event, sender: session });
        }

        // Broadcast the ORIGINAL event name to other clients, as they are not
        // aware of the server's internal prefixing convention.
        this.publishServerEvent(event, data)
      }
      return {event: events, senderId} // Return the trusted clientId
    } else {
      throwError('event or data is required', 'pub', ErrorCode.InvalidArgument)
    }
  }

  isStream(params: ServerFuncParams, context?: ToolRpcContext) {
    const method = this.getMethodFromParams(params, context)
    return (method === 'list')
  }
}

export const eventServer = new EventServer(EventName)
