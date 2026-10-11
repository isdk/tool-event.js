/**
 * Decoding of an SSE `data:` payload.
 *
 * The library publishes JSON, so a payload is normally parseable — but the
 * server side is not always this package: a plain `text/event-stream` endpoint,
 * a proxy, or a hand-written handler may send plain text. `JSON.parse` on that
 * throws, and the throw happens inside the EventSource dispatch path, where the
 * implementation reports it as a failed connection: one unparseable frame would
 * end the stream and every listener would lose the rest of the run.
 *
 * So an unparseable payload is handed over verbatim instead.
 *
 * @param raw - The `data` field of a message event, as delivered by EventSource.
 * @returns The parsed payload, the raw string when it is not JSON, or
 * `undefined` when there is no payload.
 */
export function parseEventData(raw: unknown): any {
  if (raw === null || raw === undefined) return undefined
  if (typeof raw !== 'string') return raw
  if (!raw) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}
