/**
 * Unit tests for the SSE session-identity wire layer.
 *
 * Deciding *who a request belongs to* is tool-rpc's job: an `RpcIdentityPolicy` runs once
 * per request in the RPC transport pipeline, and the SSE stream is one of those requests.
 * What this package owns — and what is pinned here — is the credential's wire shape:
 * where it is read from, what the reader sees, what `welcome` hands back, and that a
 * mount outside the RPC transport runs the policy exactly once.
 */
import { describe, it, expect, vi } from 'vitest';
import { RpcBearerPolicy, RpcSessionIdentityPolicy } from '@isdk/tool-rpc';
import {
  SSE_RESUME_LAST_EVENT_QUERY,
  SSE_SESSION_TOKEN_HEADER,
  SSE_SESSION_TOKEN_KEY,
  SSE_SESSION_TOKEN_QUERY,
  extractSessionToken,
  readSSESessionCredential,
  resolveSSEIdentity,
  sseCredentialReader,
} from '../src/utils/sse-identity';

const req = (url?: string, headers: Record<string, any> = {}) => ({ url, headers }) as any

describe('readSSESessionCredential', () => {
  it('reads the credential from the header, and from the query when there is no header', () => {
    expect(readSSESessionCredential(req('/stream', { [SSE_SESSION_TOKEN_HEADER]: 'tok-h' }))).toBe('tok-h')
    expect(readSSESessionCredential(req(`/stream?${SSE_SESSION_TOKEN_QUERY}=tok-q`))).toBe('tok-q')
  })

  it('prefers the header when both forms are present', () => {
    const request = req(`/stream?${SSE_SESSION_TOKEN_QUERY}=tok-q`, { [SSE_SESSION_TOKEN_HEADER]: 'tok-h' })
    expect(readSSESessionCredential(request)).toBe('tok-h')
  })

  it('treats a missing request, missing url and empty value as no credential', () => {
    expect(readSSESessionCredential(undefined as any)).toBeUndefined()
    expect(readSSESessionCredential(req())).toBeUndefined()
    expect(readSSESessionCredential(req('/stream'))).toBeUndefined()
    expect(readSSESessionCredential(req(`/stream?${SSE_SESSION_TOKEN_QUERY}=`))).toBeUndefined()
    expect(readSSESessionCredential(req('/stream', { [SSE_SESSION_TOKEN_HEADER]: '' }))).toBeUndefined()
  })

  it('ignores a repeated header, which Node hands over as an array', () => {
    // A duplicated header must not be coerced into a credential string.
    const request = { url: '/stream', headers: { [SSE_SESSION_TOKEN_HEADER]: ['a', 'b'] } } as any
    expect(readSSESessionCredential(request)).toBeUndefined()
  })

  it('reads the credential out of a URL that already carries other params', () => {
    const url = `/stream?p=${encodeURIComponent('{"event":["a"]}')}&${SSE_SESSION_TOKEN_QUERY}=tok`
    expect(readSSESessionCredential(req(url))).toBe('tok')
  })
})

describe('sseCredentialReader', () => {
  it('covers both planes: the SSE wire first, then the standard bearer field', () => {
    expect(sseCredentialReader(req(`/stream?${SSE_SESSION_TOKEN_QUERY}=q`))).toBe('q')
    expect(sseCredentialReader(req('/stream', { [SSE_SESSION_TOKEN_HEADER]: 'h' }))).toBe('h')
    expect(sseCredentialReader(req('/stream', { authorization: 'Bearer jwt-here' }))).toBe('jwt-here')
    // A bare value is a valid RFC 7235 credential; do not require the scheme.
    expect(sseCredentialReader(req('/stream', { authorization: 'jwt-bare' }))).toBe('jwt-bare')
  })

  it('prefers the SSE credential when a request carries both', () => {
    const request = req(`/stream?${SSE_SESSION_TOKEN_QUERY}=sse`, {
      [SSE_SESSION_TOKEN_HEADER]: 'sse-h',
      authorization: 'Bearer jwt',
    })
    expect(sseCredentialReader(request)).toBe('sse-h')
  })

  it('reads a mixed-case Authorization header, which Mailbox headers make possible', () => {
    expect(sseCredentialReader(req('/stream', { Authorization: 'Bearer mixed' }))).toBe('mixed')
  })

  it('says nothing about a credential it does not know', () => {
    expect(sseCredentialReader(req('/stream'))).toBeUndefined()
    expect(sseCredentialReader(undefined as any)).toBeUndefined()
    expect(sseCredentialReader({ headers: { authorization: ['a', 'b'] } } as any)).toBeUndefined()
  })

  it('treats a bearer header with an empty token as no credential', () => {
    // Same rule as tool-rpc's bearer reader: a header whose whole value is the scheme
    // carries nothing. Reading it as the token `Bearer` would hand `verify` a credential
    // nobody sent, and leave it indistinguishable from a token that literally is `Bearer`.
    expect(sseCredentialReader(req('/stream', { authorization: 'Bearer' }))).toBeUndefined()
    expect(sseCredentialReader(req('/stream', { authorization: 'Bearer   ' }))).toBeUndefined()
    expect(sseCredentialReader(req('/stream', { Authorization: 'bearer' }))).toBeUndefined()
    // A token that is the scheme word stays readable, so the two cases remain separable.
    expect(sseCredentialReader(req('/stream', { authorization: 'Bearer Bearer' }))).toBe('Bearer')
  })

  it('still prefers the SSE credential over a malformed bearer header', () => {
    const request = req(`/stream?${SSE_SESSION_TOKEN_QUERY}=sse`, { authorization: 'Bearer' })
    expect(sseCredentialReader(request)).toBe('sse')
  })
})

describe('extractSessionToken', () => {
  it('reads the credential from a welcome payload', () => {
    expect(extractSessionToken({ clientId: 'c', [SSE_SESSION_TOKEN_KEY]: 'tok' })).toBe('tok')
  })

  it('ignores a missing, empty or non-string credential', () => {
    expect(extractSessionToken({ clientId: 'c' })).toBeUndefined()
    expect(extractSessionToken({ [SSE_SESSION_TOKEN_KEY]: '' })).toBeUndefined()
    expect(extractSessionToken({ [SSE_SESSION_TOKEN_KEY]: 42 })).toBeUndefined()
    expect(extractSessionToken({ [SSE_SESSION_TOKEN_KEY]: { nested: 'x' } })).toBeUndefined()
    expect(extractSessionToken(undefined)).toBeUndefined()
    expect(extractSessionToken(null)).toBeUndefined()
  })
})

describe('resolveSSEIdentity', () => {
  it('runs the policy once: match first, assign only when nothing matched', async () => {
    const policy = {
      name: 'spy',
      match: vi.fn(() => ({ id: 'matched' })),
      assign: vi.fn(() => ({ id: 'assigned' })),
    }
    const identity = await resolveSSEIdentity(policy, { req: req('/stream') })

    expect(identity.id).toBe('matched')
    expect(policy.match).toHaveBeenCalledTimes(1)
    expect(policy.assign, 'a match is not a new session').not.toHaveBeenCalled()
  })

  it('assigns a fresh session when the credential matched nothing', async () => {
    const policy = {
      name: 'spy',
      match: vi.fn(() => undefined),
      assign: vi.fn(() => ({ id: 'assigned', credential: 'c1' })),
    }
    const identity = await resolveSSEIdentity(policy, { req: req('/stream'), credential: 'unknown' })

    expect(identity).toEqual({ id: 'assigned', credential: 'c1' })
    expect(policy.assign).toHaveBeenCalledTimes(1)
  })

  it('reads the credential off the request when the caller did not supply one', async () => {
    // The standalone mount only has the request; the SSE wire form has to be picked up here,
    // otherwise a reconnect would always be read as a fresh connection.
    const policy = new RpcSessionIdentityPolicy()
    const first = await resolveSSEIdentity(policy, { req: req('/stream') })
    expect(first.credential, 'the default policy issues a resume credential').toBeTruthy()

    const again = await resolveSSEIdentity(policy, {
      req: req(`/stream?${SSE_SESSION_TOKEN_QUERY}=${first.credential}`),
    })
    expect(again.id, 'the query credential resumes the same session').toBe(first.id)
    expect(again.credential, 'a resumed identity carries no new credential').toBeUndefined()
  })

  it('awaits a policy whose match is async', async () => {
    const policy = {
      name: 'async',
      match: async () => {
        await new Promise(resolve => setTimeout(resolve, 5))
        return { id: 'late' }
      },
      assign: () => ({ id: 'assigned' }),
    }
    expect((await resolveSSEIdentity(policy, { req: req('/stream') })).id).toBe('late')
  })

  it('lets a refusing policy throw rather than swallow it', async () => {
    // No reader on the policy: the layer that builds ctx owns where the credential comes
    // from, and `resolveSSEIdentity` already read the SSE wire form onto `ctx.credential`.
    // This request carries no credential anywhere, so a refusing policy has to throw.
    const policy = new RpcBearerPolicy({
      verify: () => undefined,
      allowAnonymous: false,
    })
    await expect(resolveSSEIdentity(policy, { req: req('/stream') })).rejects
      .toMatchObject({ code: 401, status: 'unauthenticated' })
  })
})

describe('resume URL contract', () => {
  it('names the query, header and payload keys the transports share', () => {
    expect(SSE_SESSION_TOKEN_QUERY).toBe('session_token')
    expect(SSE_SESSION_TOKEN_HEADER).toBe('rpc-session-token')
    expect(SSE_SESSION_TOKEN_KEY).toBe('sessionToken')
    expect(SSE_RESUME_LAST_EVENT_QUERY).toBe('last_event_id')
  })
})
