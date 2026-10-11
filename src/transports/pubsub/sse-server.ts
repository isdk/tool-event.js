import { RPC_HEADERS } from '@isdk/tool-rpc';
import { SSEChannel } from '../../utils/sse-channel';
import { createSSEIdentity, type SSEIdentityPolicy, type SSETokenIdentityOptions } from '../../utils/sse-identity';
import type { IPubSubServerTransport, PubSubClientId, PubSubServerSession } from './server';
import type { IncomingMessage, ServerResponse } from 'http';

export interface SseServerPubSubTransportOptions {
  /**
   * How a connecting request is matched to a session. Defaults to server-issued
   * tokens, which let a dropped connection resume the same session (same clientId,
   * same subscription list). Inject a policy to plug in another credential scheme —
   * a signed token, a header an authenticating proxy stamps — without touching
   * `EventServer` or `EventClient`.
   */
  identity?: SSEIdentityPolicy;
  /** Options for the default token policy. Ignored when `identity` is injected. */
  tokenIdentity?: SSETokenIdentityOptions;
  /** Passed through to the underlying `SSEChannel` (pingInterval, resumeWindow, ...). */
  channelOptions?: Record<string, any>;
}

export class SseServerPubSubTransport implements IPubSubServerTransport {
  readonly name = 'sse';
  readonly protocol = 'sse' as const;
  /** The session-identity policy in force. See `sse-identity`. */
  readonly identity: SSEIdentityPolicy;
  private channel: SSEChannel;
  private sessions = new Map<PubSubClientId, PubSubServerSession>();

  private onConn?: (s: PubSubServerSession) => void;
  private onDis?: (s: PubSubServerSession) => void;

  constructor(options: SseServerPubSubTransportOptions = {}) {
    this.identity = options.identity ?? createSSEIdentity(options.tokenIdentity);
    this.channel = new SSEChannel({ ...options.channelOptions, identity: this.identity });
  }

  connect(options?: { req: IncomingMessage; res: ServerResponse; clientId?: string, events?: string[] }): PubSubServerSession {
    const { req, res, clientId, events } = options ?? {};
    if (!req || !res) throw new Error('SSE connect requires options.req and options.res');

    // Let SSEChannel do its work. The session identity comes from the identity policy
    // and the server is the issuer — `options.clientId` is not adopted, so a client
    // cannot pick the id its `$sub`/`$publish` calls will be matched on. A request
    // presenting a credential the server issued resumes that session.
    const client = this.channel.connect(req, res, events, clientId);

    // Create a temporary session to notify the upper layer
    const session: PubSubServerSession = {
      id: client.clientId, // Use the same ID for session and client
      clientId: client.clientId,
      protocol: 'sse',
      send: (event, data) => {
        // Correctly delegate sending to the channel, targeting this specific client
        this.channel.publish(data, event, { clientId: client.clientId });
      },
      close: () => this.channel.disconnect(client),
      raw: res,
    };

    this.sessions.set(client.clientId, session);
    this.onConn?.(session);

    req.on('close', () => {
      // A resumed connection takes over the same clientId, and the stream it replaced
      // fires `close` afterwards. Only release the session this request owns, so a
      // takeover cannot delete the live session.
      if (this.sessions.get(client.clientId) === session) {
        this.sessions.delete(client.clientId);
        this.onDis?.(session);
      }
    });
    return session;
  }

  getSessionFromReq(req: IncomingMessage): PubSubServerSession | undefined {
    const clientId = req.headers[RPC_HEADERS.CLIENT_ID] as string;
    if (clientId) {
      const result = this.sessions.get(clientId);
      return result;
    }
    return undefined;
  }

  subscribe(session: PubSubServerSession, events: string[]) {
    if (session.clientId) {
      this.channel.subscribe(session.clientId, events);
    }
  }

  unsubscribe(session: PubSubServerSession, events: string[]) {
    if (session.clientId) {
      this.channel.unsubscribe(session.clientId, events);
    }
  }

  publish(event: string, data: any, target?: { clientId?: PubSubClientId | PubSubClientId[] }) {
    this.channel.publish(data, event, target);
  }

  onConnection(cb: (s: PubSubServerSession) => void) { this.onConn = cb; }
  onDisconnect(cb: (s: PubSubServerSession) => void) { this.onDis = cb; }
}
