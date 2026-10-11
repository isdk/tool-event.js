/**
 * Unit tests for the SSE session-identity policy (`sse-identity`).
 *
 * The policy decides who a connecting request belongs to, and the default one issues
 * the credential a dropped connection presents to resume its session. These cases pin
 * the boundaries that decide a resume: where the credential is read from, what a
 * credential is worth (expiry, use limit, revocation), and that nothing a client
 * supplies can select a session the server did not issue for it.
 */
import { describe, it, expect } from 'vitest';
import {
  SSE_RESUME_LAST_EVENT_QUERY,
  SSE_SESSION_TOKEN_HEADER,
  SSE_SESSION_TOKEN_KEY,
  SSE_SESSION_TOKEN_QUERY,
  SSETokenIdentityPolicy,
  createSSEIdentity,
  extractSessionToken,
  readSSESessionCredential,
  type SSEIdentityPolicy,
} from '../src/utils/sse-identity';
import { sleep } from './utils/wait';

const req = (url?: string, headers: Record<string, string> = {}) => ({ url, headers }) as any

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

describe('SSETokenIdentityPolicy', () => {
  it('mints a distinct session id per call', () => {
    const policy = createSSEIdentity()
    const ids = new Set([policy.issue({ req: req() }), policy.issue({ req: req() }), policy.issue({ req: req() })])
    expect(ids.size).toBe(3)
  })

  it('hands back one stable credential per session, and a different one per session', () => {
    const policy = createSSEIdentity()
    const first = policy.issue({ req: req() })
    const second = policy.issue({ req: req() })

    expect(policy.credential!(first)).toBe(policy.credential!(first))
    expect(policy.credential!(first)).not.toBe(policy.credential!(second))
  })

  it('resumes the session a credential was issued for', () => {
    const policy = createSSEIdentity()
    const clientId = policy.issue({ req: req() })
    const token = policy.credential!(clientId)!

    expect(policy.resolve({ req: req(`/stream?${SSE_SESSION_TOKEN_QUERY}=${token}`) })).toBe(clientId)
    expect(policy.resolve({ req: req('/stream', { [SSE_SESSION_TOKEN_HEADER]: token }) })).toBe(clientId)
  })

  it('resolves nothing for a credential it never issued', () => {
    const policy = createSSEIdentity()
    policy.issue({ req: req() }) // issue a session, so the token table is not empty

    expect(policy.resolve({ req: req('/stream?session_token=FORGED') })).toBeUndefined()
    expect(policy.resolve({ req: req('/stream', { [SSE_SESSION_TOKEN_HEADER]: 'FORGED' }) })).toBeUndefined()
    expect(policy.resolve({ req: req('/stream') })).toBeUndefined()
  })

  it('stops accepting a credential once its use limit is spent', () => {
    const policy = new SSETokenIdentityPolicy({ maxUses: 2 })
    const clientId = policy.issue({ req: req() })
    const token = policy.credential!(clientId)
    const resumeReq = req(`/stream?${SSE_SESSION_TOKEN_QUERY}=${token}`)

    expect(policy.resolve({ req: resumeReq })).toBe(clientId)
    expect(policy.resolve({ req: resumeReq })).toBe(clientId)
    expect(policy.resolve({ req: resumeReq }), 'the third presentation exceeds the use limit').toBeUndefined()
    expect(policy.resolve({ req: resumeReq })).toBeUndefined()
  })

  it('stops accepting a credential after its ttl, and slides the window when it is re-issued', async () => {
    const policy = new SSETokenIdentityPolicy({ ttlMs: 30, maxUses: 10 })
    const clientId = policy.issue({ req: req() })
    const token = policy.credential!(clientId)
    const resumeReq = req(`/stream?${SSE_SESSION_TOKEN_QUERY}=${token}`)

    // Re-issuing (what the welcome frame does on each connect) extends the window.
    for (let i = 0; i < 3; i++) {
      expect(policy.resolve({ req: resumeReq })).toBe(clientId)
      policy.credential!(clientId)
      await sleep(15)
    }
    expect(policy.resolve({ req: resumeReq }), 'the window slid with every re-issue').toBe(clientId)

    await sleep(40)
    expect(policy.resolve({ req: resumeReq }), 'an idle window lapses').toBeUndefined()
  })

  it('drops a session credential on revoke', () => {
    const policy = createSSEIdentity()
    const clientId = policy.issue({ req: req() })
    const other = policy.issue({ req: req() })
    const token = policy.credential!(clientId)!
    const otherToken = policy.credential!(other)!

    policy.revoke!(clientId)

    expect(policy.resolve({ req: req(`/stream?${SSE_SESSION_TOKEN_QUERY}=${token}`) })).toBeUndefined()
    expect(policy.resolve({ req: req(`/stream?${SSE_SESSION_TOKEN_QUERY}=${otherToken}`) }), 'revoking one session must not touch another').toBe(other)
  })

  it('names the default policy and gives it the full policy surface', () => {
    const policy = createSSEIdentity()
    expect(policy.name).toBe('server-token')
    expect(typeof policy.resolve).toBe('function')
    expect(typeof policy.issue).toBe('function')
    expect(typeof policy.credential).toBe('function')
    expect(typeof policy.revoke).toBe('function')
  })
})

describe('an injected policy', () => {
  it('can be a credential-less policy: identity only, nothing to resume', () => {
    const policy: SSEIdentityPolicy = {
      name: 'no-credential',
      resolve: () => undefined,
      issue: () => 'fixed',
    }
    expect(policy.credential).toBeUndefined()
    expect(policy.revoke).toBeUndefined()
    expect(policy.resolve({ req: req('/stream') })).toBeUndefined()
    expect(policy.issue({ req: req('/stream') })).toBe('fixed')
  })

  it('can resume from a credential of its own shape', () => {
    // Stands in for an external auth protocol: the credential is a signed string the
    // policy recognizes, not a token minted by this module.
    const policy: SSEIdentityPolicy = {
      name: 'external',
      resolve: ({ req: request }) => readSSESessionCredential(request) === 'sig=external-session' ? 'external-session' : undefined,
      issue: () => 'external-session',
      credential: (clientId) => `sig=${clientId}`,
    }
    expect(policy.credential!('external-session')).toBe('sig=external-session')
    expect(policy.resolve({ req: req('/stream?session_token=sig=external-session') })).toBe('external-session')
    expect(policy.resolve({ req: req('/stream?session_token=sig=nobody') })).toBeUndefined()
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
