import type { IncomingMessage } from 'http'
import type {
  RpcCredentialReader,
  RpcIdentity,
  RpcIdentityContext,
  RpcIdentityPolicy,
} from '@isdk/tool-rpc'

/**
 * The SSE wire layer of session identity.
 *
 * **Who a connecting request belongs to is decided by tool-rpc's `RpcIdentityPolicy`,
 * not by this module.** The policy runs once per request in the RPC transport pipeline
 * (`ServerToolTransport.resolveRequestIdentity`), and the SSE stream is one of those
 * requests: `EventServer.list` is an ordinary RPC call, so the stream and the `$sub` /
 * `$publish` calls that follow it are resolved by the *same* policy instance against the
 * *same* credential. That is what lets the channel key its session tables on
 * `ctx.identity.id` instead of a client-supplied id.
 *
 * What stays here is the part tool-rpc deliberately leaves to the transport — the
 * credential's wire shape. EventSource can send neither headers nor a changed URL on a
 * live connection, so the resume credential rides in the URL, and the `welcome` frame is
 * the only reliable way to hand it back. tool-rpc's own reader only knows `authorization`
 * (RFC 7235); a deployment has to point its transport at `sseCredentialReader` for the
 * two planes to recognize one credential.
 *
 * For a mount that does not go through the RPC transport at all (a bare `http` handler),
 * `resolveSSEIdentity` runs the policy once and hands the result to `SSEChannel.connect`.
 * The channel never resolves identity itself — a second `match` would spend the
 * credential twice and could pick a different session than the control plane did.
 */

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

const bearerPattern = /^Bearer\s+(.+)$/i

/** One header value, ignoring the array Node hands over for a repeated header. */
function singleHeaderValue(headers: any, name: string): string | undefined {
  const raw = headers?.[name]
  return typeof raw === 'string' && raw ? raw : undefined
}

function credentialFromQuery(url: string | undefined): string | undefined {
  if (!url) return undefined
  const fromQuery = new URL(url, 'http://localhost').searchParams.get(SSE_SESSION_TOKEN_QUERY)
  return fromQuery || undefined
}

/**
 * The SSE resume credential on a request: header first, then query.
 *
 * This is the reader the SSE wire needs; it deliberately says nothing about
 * `authorization`, which belongs to the RPC plane.
 */
export function readSSESessionCredential(req?: IncomingMessage): string | undefined {
  return singleHeaderValue(req?.headers, SSE_SESSION_TOKEN_HEADER) ?? credentialFromQuery(req?.url)
}

/**
 * One reader for both planes: `rpc-session-token` header → `session_token` query →
 * `authorization` bearer.
 *
 * Install it on the RPC transport — `new HttpServerToolTransport({ identity,
 * credentialReader: sseCredentialReader })` — so the stream request and the `$sub` /
 * `$publish` calls that follow it resolve to the same identity. With tool-rpc's default
 * reader the stream's query credential is invisible to the policy, and every reconnect
 * mints a new session.
 *
 * The `authorization` fallback keeps an externally issued bearer token working under the
 * same reader. (tool-rpc's own bearer reader is package-private, so the one line of
 * RFC 7235 parsing is repeated here rather than reached around.)
 */
export const sseCredentialReader: RpcCredentialReader = (req: any): string | undefined => {
  const sse = readSSESessionCredential(req)
  if (sse) return sse

  const headers = req?.headers
  const raw = singleHeaderValue(headers, 'authorization') ?? singleHeaderValue(headers, 'Authorization')
  if (raw === undefined) return undefined
  const match = bearerPattern.exec(raw.trim())
  return (match ? match[1] : raw).trim() || undefined
}

/** The credential a `welcome` payload carries, if any. */
export function extractSessionToken(data: any): string | undefined {
  const token = data?.[SSE_SESSION_TOKEN_KEY]
  return typeof token === 'string' && token ? token : undefined
}

/** Alias used where the payload arrives as a stream event. */
export const extractSessionTokenFromEvent = extractSessionToken

/**
 * Run the policy once for a mount that is not served by the RPC transport.
 *
 * `match` then `assign`, exactly as the transport pipeline does, both awaited (a policy
 * may fetch a JWKS or hit a database). When `ctx.credential` is not supplied it is read
 * off the request with `readSSESessionCredential`, which is the SSE wire form.
 *
 * Pass the result to `SSEChannel.connect` / `SseServerPubSubTransport.connect`. Do not
 * call this from a channel that is already behind the RPC transport: `ctx.identity` is
 * the resolved answer, and resolving again spends the credential a second time.
 */
export async function resolveSSEIdentity(
  policy: RpcIdentityPolicy,
  ctx: RpcIdentityContext<IncomingMessage>,
): Promise<RpcIdentity> {
  const filled: RpcIdentityContext<IncomingMessage> = ctx.credential === undefined
    ? { ...ctx, credential: readSSESessionCredential(ctx.req) }
    : ctx

  // `match` returning undefined means "start a new session", not "refuse": a refusal is
  // the policy throwing, and that error belongs to the caller's error handling.
  return (await policy.match(filled)) ?? (await policy.assign(filled))
}
