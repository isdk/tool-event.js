import type { IncomingMessage } from 'http'
import { uuid } from '@isdk/hash'

/**
 * Session identity for the SSE channel.
 *
 * Who a connecting request *belongs to* is a policy decision, not a constant. The
 * channel used to hardcode it (`uuid()` on every connection), which meant a dropped
 * connection always landed on a brand-new session: a new clientId, and a subscription
 * list rebuilt from the reconnect URL — i.e. the list from the *first* connect, so
 * anything subscribed afterwards was silently lost.
 *
 * The default policy keeps the server as the issuer (a client cannot pick the id its
 * `$sub`/`$publish` calls are matched on, which is the anti-impersonation property the
 * channel relies on) and hands the client a token that lets the same session be
 * resumed. An injected policy can implement any other credential scheme — a signed
 * token, a header an authenticating proxy stamps, an external auth protocol — without
 * the channel, `EventServer` or `EventClient` changing.
 */
export interface SSEIdentityPolicy {
  /** Human-readable policy name, surfaced in diagnostics. */
  readonly name: string

  /**
   * The session id this request is resuming, if it presents a valid credential.
   * Return undefined for a fresh connection. Expiry is the policy's own business.
   *
   * The channel applies one gate of its own on top of this: the resumed session must
   * still be inside its resume window. A credential the policy accepts for a session
   * whose window has closed mints a new session — the credential alone never keeps a
   * dead one alive.
   */
  resolve: (ctx: { req: IncomingMessage }) => string | undefined

  /** Mint the session id for a fresh connection. */
  issue: (ctx: { req: IncomingMessage }) => string

  /**
   * The credential to hand back to the client (via the welcome frame) so it can
   * present it when it reconnects. Omit it to disable resuming for this policy.
   */
  credential?: (clientId: string) => string | undefined

  /** Drop a client's credential(s), e.g. when its stream is closed for good. */
  revoke?: (clientId: string) => void
}

/** Query param carrying the resume credential. EventSource cannot set headers. */
export const SSE_SESSION_TOKEN_QUERY = 'session_token'
/** Header form, for clients that can set one (Node transports, proxies). */
export const SSE_SESSION_TOKEN_HEADER = 'rpc-session-token'
/**
 * Query param carrying the last event id a resumed stream saw.
 *
 * A reconnecting `EventSource` reports it in the `last-event-id` header, but a
 * resumed stream is a *new* EventSource (the credential has to ride in the URL) and
 * the `eventsource` implementation exposes no way to set that header — so the id is
 * handed over in the URL and the channel reads it where it reads the header.
 */
export const SSE_RESUME_LAST_EVENT_QUERY = 'last_event_id'
/** Key of the credential inside the `welcome` event payload. */
export const SSE_SESSION_TOKEN_KEY = 'sessionToken'

/** Read the resume credential from a request (header first, then query). */
export function readSSESessionCredential(req: IncomingMessage): string | undefined {
  const fromHeader = req?.headers?.[SSE_SESSION_TOKEN_HEADER]
  if (typeof fromHeader === 'string' && fromHeader) return fromHeader
  if (!req?.url) return undefined
  const fromQuery = new URL(req.url, 'http://localhost').searchParams.get(SSE_SESSION_TOKEN_QUERY)
  return fromQuery || undefined
}

/** The credential a `welcome` payload carries, if any. */
export function extractSessionToken(data: any): string | undefined {
  const token = data?.[SSE_SESSION_TOKEN_KEY]
  return typeof token === 'string' && token ? token : undefined
}

/** Alias used where the payload arrives as a stream event. */
export const extractSessionTokenFromEvent = extractSessionToken

export interface SSETokenIdentityOptions {
  /**
   * How long an issued credential stays valid. Default 30s. Slides forward every time
   * the credential is presented (an idle credential lapses; an active one does not).
   */
  ttlMs?: number
  /**
   * How many times one credential may be presented. Default 5. Counts *presentations*
   * (`resolve` calls) — the connect that mints the credential does not count, and a
   * re-issue slides the ttl without resetting the count. Past the limit the credential
   * vouches for nothing and the reconnect starts a new session.
   */
  maxUses?: number
}

interface IssuedToken {
  clientId: string
  expiresAt: number
  uses: number
}

/**
 * Default policy: the server mints the session id and issues an opaque token bound
 * to it. A reconnect presenting an issued token resumes that session; a token the
 * server never issued resolves to nothing, so a forged id/token never selects one.
 *
 * The token is deliberately opaque and single-purpose: it names a session, nothing
 * more. Authentication stays outside the event protocol — an external auth protocol
 * replaces this policy, it does not extend it.
 */
export class SSETokenIdentityPolicy implements SSEIdentityPolicy {
  readonly name = 'server-token'
  private readonly ttlMs: number
  private readonly maxUses: number
  /** token -> issuance record */
  private readonly tokens = new Map<string, IssuedToken>()

  constructor(options: SSETokenIdentityOptions = {}) {
    this.ttlMs = options.ttlMs ?? 30_000
    this.maxUses = options.maxUses ?? 5
  }

  resolve({ req }: { req: IncomingMessage }): string | undefined {
    const token = readSSESessionCredential(req)
    if (!token) return undefined
    const issued = this.tokens.get(token)
    if (!issued) return undefined
    if (issued.expiresAt <= Date.now() || issued.uses >= this.maxUses) {
      this.tokens.delete(token)
      return undefined
    }
    issued.uses += 1
    return issued.clientId
  }

  /** The request is accepted for interface parity; the default id ignores it. */
  issue(_ctx?: { req: IncomingMessage }): string {
    return uuid()
  }

  /**
   * The token for a session, minted on first use. Re-issuing for the same session
   * slides its window, so a client that keeps dropping keeps resuming — up to its use
   * limit, which re-issuing deliberately does not reset.
   */
  credential(clientId: string): string | undefined {
    for (const [token, issued] of this.tokens) {
      if (issued.clientId === clientId) {
        issued.expiresAt = Date.now() + this.ttlMs
        return token
      }
    }
    const token = uuid()
    this.tokens.set(token, { clientId, expiresAt: Date.now() + this.ttlMs, uses: 0 })
    return token
  }

  revoke(clientId: string): void {
    for (const [token, issued] of this.tokens) {
      if (issued.clientId === clientId) this.tokens.delete(token)
    }
  }
}

/**
 * The policy the SSE channel uses when none is injected: server-issued opaque
 * tokens, so a reconnect resumes the same session instead of landing on a new one.
 */
export function createSSEIdentity(options?: SSETokenIdentityOptions): SSEIdentityPolicy {
  return new SSETokenIdentityPolicy(options)
}
