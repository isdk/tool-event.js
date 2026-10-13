import { RPC_HEADERS, RpcError, RpcStatusCode, type RpcIdentity } from '@isdk/tool-rpc';
import { SSEChannel } from '../../utils/sse-channel';
import type { IPubSubServerTransport, PubSubClientId, PubSubServerSession } from './server';
import type { IncomingMessage, ServerResponse } from 'http';

export interface SseServerPubSubTransportOptions {
  /**
   * Called with a session id when the channel is reset and that session may no longer be
   * resumed. Wire it to the identity policy installed on the RPC transport
   * (`(id) => identity.revoke?.(id)`) so a reset does not leave credentials behind.
   *
   * The transport holds no policy of its own: identity is decided once, by the RPC
   * transport's `RpcIdentityPolicy`, and handed to `connect()` as `ctx.identity`.
   */
  revoke?: (identityId: string) => void;
  /** Passed through to the underlying `SSEChannel` (pingInterval, resumeWindow, ...). */
  channelOptions?: Record<string, any>;
}

export class SseServerPubSubTransport implements IPubSubServerTransport {
  readonly name = 'sse';
  readonly protocol = 'sse' as const;
  private channel: SSEChannel;
  /** Sessions keyed by the id the identity policy assigned, never by a client-supplied one. */
  private sessions = new Map<PubSubClientId, PubSubServerSession>();

  private onConn?: (s: PubSubServerSession) => void;
  private onDis?: (s: PubSubServerSession) => void;

  constructor(options: SseServerPubSubTransportOptions = {}) {
    this.channel = new SSEChannel({ ...options.channelOptions, revoke: options.revoke });
  }

  connect(options?: {
    req: IncomingMessage;
    res: ServerResponse;
    /** Deprecated: a client-supplied id is never adopted. See `identity`. */
    clientId?: string;
    events?: string[];
    /** The session this request belongs to, as decided by the RPC transport (`ctx.identity`). */
    identity?: RpcIdentity;
  }): PubSubServerSession {
    const { req, res, events, identity } = options ?? {};
    if (!req || !res) throw new Error('SSE connect requires options.req and options.res');
    assertSSEIdentity(identity);

    // The channel does its work with the identity the RPC transport resolved for this
    // request. `options.clientId` is dropped on the floor: adopting it would let a client
    // pick the id its `$sub`/`$publish` calls are matched on, which is exactly the hole
    // the identity policy exists to close.
    const client = this.channel.connect(req, res, events, identity);

    const session: PubSubServerSession = {
      id: client.clientId, // Use the same ID for session and client
      clientId: client.clientId,
      identity,
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

  /**
   * The session belonging to an identity the policy resolved — the lookup `$sub`,
   * `$unsub` and `$publish` should use.
   */
  getSessionFromIdentity(identityId?: PubSubClientId): PubSubServerSession | undefined {
    return identityId ? this.sessions.get(identityId) : undefined;
  }

  /**
   * @deprecated Reads the self-reported `rpc-client-id` header, which is the value an
   * identity policy exists to stop trusting. Use `getSessionFromIdentity(ctx.identity.id)`;
   * with no policy installed, `ctx.clientId` carries the same header value anyway.
   */
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

/**
 * The error an SSE stream request gets when the RPC transport it is served by has no
 * identity policy: there is no server-decided id to key the session on, so the stream
 * cannot be opened. The fix is one line, and it is the line that makes `$sub`/`$publish`
 * trustworthy too.
 */
export const SSE_IDENTITY_REQUIRED_MESSAGE =
  'The SSE stream requires an identity policy on the RPC transport: '
  + 'new HttpServerToolTransport({ identity: new RpcSessionIdentityPolicy(), credentialReader: sseCredentialReader })';

export function assertSSEIdentity(identity?: RpcIdentity): asserts identity is RpcIdentity {
  if (!identity?.id) {
    throw new RpcError(SSE_IDENTITY_REQUIRED_MESSAGE, RpcStatusCode.UNAUTHENTICATED, 'unauthenticated');
  }
}
