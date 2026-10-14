/**
 * The close half of the PubSub contract, shared by every transport.
 *
 * A PubSub session can end on either side of the wire. When the *client* ends it,
 * teardown is local and obvious. When the *server* ends it, the client has to be
 * told, or its streams keep reporting `readyState === 1` (OPEN) and keep sending
 * frames the server then drops — and a later `close()` on such a stale stream gets
 * charged against whatever session the peer holds by then, ending a live one.
 *
 * This module owns the vocabulary (names, reasons) and the client-side behaviour
 * (closing every stream at once). Transports decide only how the notice travels:
 *
 * - **Electron** (`@isdk/tool-electron`): its own IPC channel,
 *   `pubsub-close:{namespace}`. The channel namespace isolates it from application
 *   event names, so the bare `close` is safe there — and it isolates sessions too:
 *   a window connected to two namespaces gets one notice per namespace, and each
 *   notice ends only that namespace's streams.
 * - **SSE** (`SseServerPubSubTransport`): a frame on the stream itself, named
 *   {@link SSE_CLOSE_EVENT}. SSE has no separate channel, so the frame shares the
 *   application's event namespace and needs the control-plane `$` prefix that
 *   `$sub`/`$unsub`/`$publish` already use. It is opt-in on both ends
 *   (`closeSignal`), because SSE's default answer to a server-side close is
 *   "the stream dropped; resume it".
 */

/**
 * Name the server answers a connect with, carrying the session identity only the
 * server can know (a `webContents.id`, an identity-policy-assigned id, ...).
 *
 * On SSE it is an *event name* on the stream; on Electron it is a *channel-name
 * suffix* (`pubsub-welcome:{namespace}`), which keeps it out of the application's
 * event namespace. Same purpose, different layer of the wire.
 */
export const PubSubWelcomeEvent = 'welcome'

/**
 * Base name of the "this session has ended" notice.
 *
 * A transport prefixes or namespaces it as its wire requires — see
 * {@link SSE_CLOSE_EVENT} for SSE, and `pubsub-close:{namespace}` for Electron.
 * It is deliberately not a name the client's event dispatcher sees on SSE unless
 * `closeSignal` is enabled: an application event called `close` must not be
 * mistaken for a session teardown.
 */
export const PubSubCloseEvent = 'close'

/**
 * Control-plane prefix used on the SSE stream, matching the `$sub`/`$unsub`/
 * `$publish` tool names of `EventServer`. Application event names rarely carry
 * it, which is what makes the frame unambiguous without a separate channel.
 */
export const SSE_CONTROL_EVENT_PREFIX = '$'

/** The SSE frame name for a server-ended session: `$close`. */
export const SSE_CLOSE_EVENT = `${SSE_CONTROL_EVENT_PREFIX}${PubSubCloseEvent}`

/**
 * Why the server ended a session.
 *
 * The values here are transport-neutral; a transport may add its own (the union
 * stays open with `string & {}`) — `@isdk/tool-electron` reports `window-destroyed`
 * and `renderer-gone` alongside these.
 *
 * - `server` — application code called `session.close()`.
 * - `navigation` — the client's document/context was replaced (a renderer reload,
 *   a main-frame navigation), which destroys its streams without any goodbye.
 * - `client-gone` — the client endpoint vanished, generically. A transport that can
 *   tell the cases apart names them itself (Electron: `window-destroyed` and
 *   `renderer-gone`); one that cannot tell a vanished client from a dropped
 *   connection does not announce it at all (SSE: a drop is resumable, so it is not
 *   a close).
 * - `transport-cleanup` — the server transport itself was torn down while the
 *   session was still live.
 *
 * A close the client asked for itself carries no notice at all: it already knows.
 */
export type PubSubSessionCloseReason =
  | 'server'
  | 'navigation'
  | 'client-gone'
  | 'transport-cleanup'
  | (string & {})

/** Payload of a close notice: {@link PubSubCloseEvent} on Electron, {@link SSE_CLOSE_EVENT} on SSE. */
export type PubSubCloseNotice = {
  reason: PubSubSessionCloseReason
}

/**
 * Take one client stream down.
 *
 * @param notifyPeer - False when the server already ended the session (its notice
 *   is what got us here). Telling it again would decrement the count of a session
 *   this stream no longer belongs to — possibly one a later `connect()` created
 *   under the same peer id — which is how a stale stream ends a live session.
 */
export type PubSubStreamTeardown = (notifyPeer: boolean) => void

/**
 * Every stream sharing one peer session, so a session-level close can close them all
 * at once and transport teardown can release them too.
 *
 * One registry per session, not one per transport. Streams of one session usually
 * share a peer (one `WebContents`, one SSE stream per `connect()`), so the notice
 * arrives once and applies to all of them — but a client transport that serves more
 * than one namespace (`ElectronClientPubSubTransport` after a mid-life
 * `setApiRoot()`) holds several sessions on one window, and keeps a registry per
 * namespace: a notice for one session must not close the others, and closing their
 * streams on its behalf would leave the peer's count for those sessions unreleasable.
 * Keeping the set here rather than in each transport is what stops the two ends from
 * drifting apart: a transport that forgets one stream leaves a renderer whose
 * `readyState` still says OPEN.
 *
 * A teardown is expected to be idempotent (guard on its own closed state): a later
 * `stream.close()` reaches it again, and a teardown that unregisters itself races
 * nothing, because {@link closeAll} already dropped it.
 */
export class PubSubStreamRegistry {
  private teardowns = new Set<PubSubStreamTeardown>()

  /** Track a stream's teardown. Returns the unregister function. */
  register(teardown: PubSubStreamTeardown): () => void {
    this.teardowns.add(teardown)
    return () => this.teardowns.delete(teardown)
  }

  /** Stop tracking a teardown (a stream that closed on its own). */
  unregister(teardown: PubSubStreamTeardown): void {
    this.teardowns.delete(teardown)
  }

  /**
   * Close every tracked stream. Iterates a copy: a teardown unregisters itself.
   *
   * @param notifyPeer - See {@link PubSubStreamTeardown}. `false` after the server
   *   told us; `true` when we are the ones giving up (transport cleanup).
   */
  closeAll(notifyPeer: boolean): void {
    // Drop them up front: the registry tracks live streams, so it must not keep a
    // stream that was closed here even if its teardown does not unregister itself.
    const pending = [...this.teardowns]
    this.teardowns.clear()
    for (const teardown of pending) {
      teardown(notifyPeer)
    }
  }

  /** Streams still tracked. */
  get size(): number {
    return this.teardowns.size
  }
}
