import { IncomingMessage, ServerResponse } from "http";
import { throwError } from "@isdk/common-error";
import { toEventMatcher } from './event-pattern';
import { SSE_RESUME_LAST_EVENT_QUERY, SSEIdentityPolicy, SSETokenIdentityPolicy } from './sse-identity';

type Events = (string | RegExp)[];

/**
 * Represents a client connected to the SSE channel.
 */
export type SSEClient = {
  /** The incoming HTTP request from the client. */
  req: IncomingMessage;
  /** The server response object used to send events to the client. */
  res: ServerResponse;
  /** An array of event names or patterns that the client is subscribed to. */
  events?: Events;
  /**
   * A unique identifier for the client.
   */
  clientId: string;
}

/**
 * Checks if an event matches with the subscription list.
 * @param subscriptionList - A list of events to check.
 * @param eventName - The name of the event.
 * @returns - Returns true if the event matches with the subscription list, otherwise false.
 */
function hasEventMatch(subscriptionList: Events | undefined, eventName: string) {
  return !subscriptionList || subscriptionList.some(pat => pat instanceof RegExp ? pat.test(eventName) : pat === eventName);
}

export const SSEChannelAlreadyClosedErrCode = 498

/**
 * A class for creating Server-Sent Events (SSE) channels.
 * @example
 * const sseChannel = new SSEChannel({ pingInterval: 5000 })
 * sseChannel.publish('Hello, world!', 'greeting')
 */
export class SSEChannel {
  _active: boolean
  clients: Map<string, SSEClient>
  messages: Record<string, any>[]
  nextID: number
  options: Record<string, any>
  pingTimer?: NodeJS.Timeout
  /** How a connecting request is matched to a session. Injectable; see `sse-identity`. */
  identity: SSEIdentityPolicy
  /**
   * Sessions that can be resumed, keyed by clientId. The live connection is dropped as
   * soon as the socket closes, so this is what survives a drop: the subscription list
   * the session had, plus the window in which it may be resumed.
   */
  resumable: Map<string, { events?: Events, expiresAt: number }>

  /** A session is resumable while its window is open. */
  isResumable(clientId: string): boolean {
    const record = this.resumable.get(clientId)
    return !!record && record.expiresAt > Date.now()
  }

  /** Keep the resumable list in step with the live session's subscriptions. */
  private syncResumable(clientId: string, events?: Events) {
    const record = this.resumable.get(clientId)
    if (record) {
      record.events = events
      record.expiresAt = Date.now() + this.options.resumeWindow
    }
  }

  /**
   * Gets the active status of the channel.
   * @returns True if the channel is active, false otherwise.
   */
  get active() {
    return this._active
  }

  set active(v : boolean) {
    if (v !== this._active) {
      if (v) {
        if (this.pingTimer) {
          clearInterval(this.pingTimer);
          this.pingTimer = undefined
        }
        if (this.options.pingInterval > 0) {
          this.pingTimer = setInterval(() => this.publish(), this.options.pingInterval);
        }
      } else {
        // Not only the live streams: a closed channel must not leave resumable sessions
        // (and their credentials) behind, even when the last stream had already dropped.
        this.clearClients()
        if (this.pingTimer) {
          clearInterval(this.pingTimer);
          this.pingTimer = undefined
        }
      }
      this._active = v;
    }
  }


  /**
   * Creates a new SSE channel.
   * @param options - The options for the SSE channel.
   * @param options.pingInterval - Interval in milliseconds to send ping messages (default: 3000).
   * @param options.maxStreamDuration - Maximum duration of a client connection in milliseconds (default: 30000). When it fires the server ends the stream itself; that is a drop like any other, so it opens the resume window and the session is resumed by its credential rather than re-created. `0` disables the limit.
   * @param options.clientRetryInterval - Interval in milliseconds for clients to retry connection (default: 1000).
   * @param options.startId - Starting ID for messages (default: 1).
   * @param options.historySize - Maximum number of messages to keep in history (default: 100). This is what bounds a reconnect's replay: everything published since the id the client acknowledged, as long as it is still in this buffer.
   * @param options.rewind - Number of historical messages to send to new clients (default: 0).
   * @param options.cors - Whether to enable CORS headers (default: false).
   * @param options.resumeWindow - How long a dropped session may be resumed with its
   *   subscription list (default: 30000). The window is (re)opened at every drop and at
   *   every connect, so a session that keeps dropping stays resumable; `0` closes it at
   *   the drop, which turns every reconnect into a new session.
   * @param options.identity - Session identity policy (default: `SSETokenIdentityPolicy`,
   *   server-issued token). Inject one to plug in a different credential scheme.
   */
  constructor(options?: Record<string, any>) {
    this.options = Object.assign(
      {},
      {
        pingInterval: 3000,
        maxStreamDuration: 30000,
        clientRetryInterval: 1000,
        startId: 1,
        historySize: 100,
        rewind: 0,
        cors: false,
        resumeWindow: 30000
      },
      options
    )

    this.nextID = this.options.startId
    this.clients = new Map()
    this.messages = []
    this.resumable = new Map()
    this.identity = this.options.identity ?? new SSETokenIdentityPolicy()
    this.active = true
  }

  /**
   * Publishes data to the channel.
   *
   * @param data The data to send. Can be a string or a serializable object.
   * @param eventName Optional name for the event.
   * @param target Optional. If provided, the message will be sent only to clients with matching `clientId`s, bypassing event subscriptions.
   * @returns The ID of the message, or `undefined` if no message was sent.
   * @throws An error if the channel is closed.
   */
  publish(data?: string | Record<string, any>, eventName?: string, target?: { clientId?: string | string[] }) {
    // console.log('🚀 ~ SSEChannel ~ publish ~ eventName:', eventName, data)
    if (!this.active) throwError('Channel closed', 'SSEChannel', SSEChannelAlreadyClosedErrCode);
    let output: string;
    let id: number | undefined;
    let _eventName: string | undefined = eventName

    if (!data && !eventName) {
      if (!this.clients.size) return; // No need to create a ping entry if there are no clients connected
      output = "data: \n\n";
    } else {
      id = this.nextID++;
      if (typeof data === "object") {
        if (data.event) {
          _eventName = data.event;
          if (data.data !== undefined) data = JSON.stringify(data.data)
        } else {
          data = JSON.stringify(data);
        }
      }
      if (data && typeof data !== "string") {
        data = '' + data;
      }
      data = data ? data.split(/[\r\n]+/).map((str: string) => 'data: ' + str).join('\n') : '';
      output = (
        "id: " + id + "\n" +
        (eventName ? "event: " + eventName + "\n" : "") +
        (data || "data: ") + '\n\n'
      );
      // The Last-Event-ID replay in `connect` filters the history on `eventName`.
      // Recording only `_eventName` left that key undefined, so a reconnecting client
      // with a subscription list got nothing replayed. Keep the old key as well.
      this.messages.push({ id, eventName: _eventName, _eventName, output });
    }

    if (target?.clientId) {
      const targetIds = Array.isArray(target.clientId) ? target.clientId : [target.clientId];
      targetIds.forEach(id => {
        const client = this.clients.get(id);
        if (client) {
          client.res.write(output);
        }
      });
    } else {
      this.clients.forEach(c => {
        if (!_eventName || hasEventMatch(c.events, _eventName)) {
          c.res.write(output)
        }
      });
    }

    while (this.messages.length > this.options.historySize) {
      this.messages.shift();
    }

    return id;
  }

  /**
   * Adds event subscriptions to an active client.
   * @param clientId The ID of the client to modify.
   * @param events An array of event names or patterns to add.
   * @returns `true` if the client was found and updated, otherwise `false`.
   */
  subscribe(clientId: string, events: Events): boolean {
    if (!this.active) throwError('Channel closed', 'SSEChannel', SSEChannelAlreadyClosedErrCode);
    if (events instanceof RegExp || typeof events === 'string') { events = [events]; }

    const client = this.clients.get(clientId);
    if (client) {
      if (!client.events) {
        client.events = [];
      }
      for (const event of events) {
        const normalized = toEventMatcher(event);
        if (!client.events.some(e => e.toString() === normalized.toString())) {
          client.events.push(normalized);
        }
      }
      this.syncResumable(clientId, client.events);
      return true;
    }
    return false;
  }

  /**
   * Removes event subscriptions from an active client.
   * @param clientId The ID of the client to modify.
   * @param events An array of event names or patterns to remove.
   * @returns `true` if the client was found and updated, otherwise `false`.
   */
  unsubscribe(clientId: string, events: Events): boolean {
    if (!this.active) throwError('Channel closed', 'SSEChannel', SSEChannelAlreadyClosedErrCode);
    if (events instanceof RegExp || typeof events === 'string') { events = [events]; }

    const client = this.clients.get(clientId);
    if (client) {
      if (client.events) {
        const normalizedToRemove = events.map(e => toEventMatcher(e));
        client.events = client.events.filter(existingEvent =>
          !normalizedToRemove.some(eventToRemove => eventToRemove.toString() === existingEvent.toString())
        );
      }
      this.syncResumable(clientId, client.events);
      return true;
    }
    return false;
  }

  /**
   * Finds a client instance by its unique ID.
   * @param clientId The unique ID of the client.
   * @returns The matching SSEClient, or undefined if not found.
   */
  getClient(clientId: string): SSEClient | undefined {
    return this.clients.get(clientId);
  }

  /**
   * Establishes a new SSE connection with a client and adds it to the channel.
   *
   * @param req The incoming HTTP request from the client.
   * @param res The server response object used to send events to the client.
   * @param events An array of event names or patterns that the client wants to subscribe to.
   *   For a resumed session this is ignored: the list the session had at the drop is the
   *   live truth (it absorbed every `$sub`/`$unsub`), while a reconnect URL only carries
   *   the list from the *first* connect.
   * @param clientId Accepted for signature compatibility only — the server is the issuer
   *   and never adopts a client-supplied id, which is what keeps `$sub`/`$publish` from
   *   being aimed at someone else's session.
   * @returns The newly created client object representing the connected client.
   *
   * A session has one live stream. A connection that resumes a session whose stream is
   * still live takes it over: the replaced stream is closed, so a publish is delivered
   * once under that clientId and the session registry keeps pointing at the live stream.
   * @throws An error if the channel is closed or if a client ID cannot be determined.
   */
  connect(req: IncomingMessage, res: ServerResponse, events?: Events, clientId?: string) {
    if (!this.active) throwError('Channel closed', 'SSEChannel', SSEChannelAlreadyClosedErrCode);

    // Identity comes from the policy, and the server stays the issuer: a client cannot
    // pick the id its `$sub`/`$publish` calls are matched on. A reconnect presenting a
    // credential the server issued resumes that session; anything else mints a new id.
    let resumedId = this.identity.resolve({ req })
    if (resumedId && !this.isResumable(resumedId)) resumedId = undefined
    const finalClientId = resumedId ?? this.identity.issue({ req });

    if (this.clients.has(finalClientId)) {
      const oldClient = this.clients.get(finalClientId);
      if (oldClient) {
        this.disconnect(oldClient);
      }
    }

    if (events instanceof RegExp || typeof events === 'string') {events = [events]};
    if (events) {
      events = events.map(e => toEventMatcher(e)) as Events;
    }
    // A resumed session keeps the subscription list it had when the connection died:
    // that list is the live truth (it already absorbed every `$sub`/`$unsub`), while the
    // reconnect URL only carries the list from the *first* connect. Merging the URL list
    // back in would resurrect events the client had explicitly unsubscribed.
    const finalEvents = resumedId
      ? (this.resumable.get(resumedId)?.events ?? events)
      : events;
    const c: SSEClient = { req, res, events: finalEvents, clientId: finalClientId };
    const maxStreamDuration = this.options.maxStreamDuration
    let cacheControl = 'max-age=0, stale-while-revalidate=0, stale-if-error=0, no-transform'
    if (maxStreamDuration > 0) {
      cacheControl += ", s-maxage=" + (Math.floor(maxStreamDuration / 1000) - 1)
    }
    const headers: any = {
      "Content-Type": "text/event-stream",
      "Cache-Control": cacheControl,
      "Connection": "keep-alive",
    }
    if (this.options.cors) {
      headers['Access-Control-Allow-Origin'] = "*";
    }
    c.req.socket.setNoDelay(true);
    c.res.writeHead(200, headers);
    let body = "retry: " + this.options.clientRetryInterval + '\n\n';

    // A resumed stream is a new EventSource, which cannot set the `last-event-id`
    // header, so it reports the id in the URL instead.
    const lastEventIdHeader = req.headers['last-event-id']
      ?? new URL(req.url ?? '', 'http://localhost').searchParams.get(SSE_RESUME_LAST_EVENT_QUERY)
    const lastID = Number.parseInt(lastEventIdHeader as any, 10);
    const rewind = (!Number.isNaN(lastID)) ? ((this.nextID - 1) - lastID) : this.options.rewind;
    if (rewind) {
      this.messages.filter(m => hasEventMatch(c.events, m.eventName)).slice(0 - rewind).forEach(m => {
        body += m.output
      });
    }

    c.res.write(body);
    this.clients.set(c.clientId, c);
    this.resumable.set(c.clientId, { events: c.events, expiresAt: Date.now() + this.options.resumeWindow });

    // Send a welcome message with the server-assigned clientId, plus the credential that
    // lets this session be resumed if the connection drops. The standard EventSource API
    // gives no way to send anything upstream, so the welcome frame is the only reliable
    // channel for handing both to the client.
    this.publish(
      { clientId: finalClientId, sessionToken: this.identity.credential?.(finalClientId) },
      'welcome',
      { clientId: finalClientId }
    );

    if (maxStreamDuration > 0) {
      setTimeout(() => {
        if (!c.res.writableEnded) {
          this.disconnect(c);
        }
      }, maxStreamDuration);
    }
    c.res.on('close', () => this.disconnect(c));
    return c;
  }

  /**
   * Disconnects a client from the SSE channel and cleans up resources.
   * @param c - The client to disconnect.
   */
  disconnect(c: SSEClient) {
    c.res.end()
    this.clients.delete(c.clientId)
    // The drop is what starts the resume window: the session stays resumable (with its
    // subscription list) for `resumeWindow` after the connection is gone.
    const record = this.resumable.get(c.clientId)
    if (record) record.expiresAt = Date.now() + this.options.resumeWindow
  }

  /**
   * Disconnects all clients from the SSE channel.
   */
  clearClients() {
    // An explicit channel reset is not a drop: nothing may be resumed after it, and
    // `resolve` only ever resumes a session inside its window.
    const known = new Set<string>([...this.clients.keys(), ...this.resumable.keys()])
    this.clients.forEach(c => c.res.end())
    this.clients.clear()
    this.resumable.clear()
    for (const clientId of known) this.identity.revoke?.(clientId)
  }

  /**
   * Lists the clients connected to the SSE channel grouped by IP address.
   * @returns - Returns an object where the keys are the IP addresses and the values are the number of clients connected from each IP.
   */
  listClients() {
    const rollupByIP = {} as Record<string, number>
    this.clients.forEach((c) => {
      const ip = c.req.socket.remoteAddress ?? ''
      if (!(ip in rollupByIP)) {
        rollupByIP[ip] = 0
      }
      rollupByIP[ip]++
    })
    return rollupByIP
  }

  /**
   * Gets the number of clients subscribed to the SSE channel.
   * @returns - Returns the number of clients.
   */
  getSubscriberCount() {
    return this.clients.size
  }
}

