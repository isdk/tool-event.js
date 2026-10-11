/**
 * Waiting helpers for the test suites.
 *
 * Fixed `sleep(N)` before an assertion is the main source of CI flakiness: on a
 * loaded runner the event has not arrived yet, on an idle runner the test pays
 * the full delay for nothing. These helpers poll the condition and resolve as
 * soon as it holds, so a healthy run is fast and a slow run still has its full
 * timeout budget.
 */

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export interface WaitOptions {
  /** How long to keep polling before failing. Default 3000ms. */
  timeout?: number
  /** Poll spacing. Default 20ms. */
  interval?: number
  /** Shown in the timeout message. */
  label?: string
}

/**
 * Poll `condition` until it returns true.
 * @throws when the timeout expires without the condition holding.
 */
export async function waitFor(condition: () => boolean, options: WaitOptions = {}): Promise<void> {
  const { timeout = 3000, interval = 20, label = 'condition' } = options
  const deadline = Date.now() + timeout
  for (;;) {
    if (condition()) return
    if (Date.now() >= deadline) {
      throw new Error(`waitFor timed out after ${timeout}ms: ${label}`)
    }
    await sleep(interval)
  }
}

export interface SettleOptions extends WaitOptions {
  /** Extra window to keep observing after the condition holds. Default 100ms. */
  settle?: number
}

/**
 * Poll until `condition` holds, then keep observing for `settle` ms.
 *
 * Use this for exact-count assertions ("delivered exactly once"): the poll makes
 * the test fast, the settle window is what proves no extra delivery arrived.
 */
export async function waitForSettled(
  condition: () => boolean,
  options: SettleOptions = {},
): Promise<void> {
  const { settle = 100, ...wait } = options
  await waitFor(condition, wait)
  await sleep(settle)
}
