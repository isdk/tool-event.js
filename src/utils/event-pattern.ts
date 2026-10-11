import { isRegExpStr, toRegExp } from 'util-ex'

/**
 * Normalizes an event pattern string.
 *
 * If the string is a string-form regex (starting and ending with `/`),
 * it is converted to a RegExp object. Otherwise returns as-is.
 *
 * This matches events-ex behavior.
 *
 * @param pattern - The event pattern string to normalize.
 * @returns A RegExp object or the original string.
 */
export function normalizeEventPattern(pattern: string): string | RegExp {
  return isRegExpStr(pattern) ? toRegExp(pattern) : pattern
}

/**
 * Normalizes any event pattern into something safe to match event names with.
 *
 * `normalizeEventPattern` keeps the flags as written, and `RegExp.prototype.test`
 * is stateful for the `g` and `y` flags: it advances `lastIndex`, so a pattern
 * like `/^a-.*$/g` matches every other candidate name. Matching here is a
 * pure yes/no question per event name, so those two flags are dropped; every
 * other flag (`i`, `m`, `s`, `u`, `d`) is preserved.
 *
 * @param pattern - A pattern: an event name, a string-form regex, or a RegExp.
 * @returns The event name as-is, or a stateless RegExp for matching.
 */
export function toEventMatcher(pattern: string | RegExp): string | RegExp {
  const normalized = pattern instanceof RegExp
    ? toRegExp(pattern)
    : normalizeEventPattern(pattern)
  if (normalized instanceof RegExp) {
    const flags = normalized.flags.replace(/[gy]/g, '')
    return flags === normalized.flags
      ? normalized
      : new RegExp(normalized.source, flags)
  }
  return normalized
}

/**
 * The key a pattern is tracked by: its source text.
 *
 * A string pattern and the regex form of the same source, e.g. `'group:.*'` and
 * `/group:.*$/`, are the same subscription, so exact and regex forms of one
 * pattern share a key and dedupe against each other.
 *
 * @param pattern - A pattern: an event name, a string-form regex, or a RegExp.
 * @returns The string used to identify this pattern.
 */
export function eventPatternKey(pattern: string | RegExp): string {
  return typeof pattern === 'string' ? pattern : pattern.toString()
}
