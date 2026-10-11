/**
 * Tests for src/utils/event-pattern.ts
 *
 * Verifies that normalizeEventPattern correctly converts string-form RegExp
 * patterns (e.g., /^group:.*$/) to RegExp objects, matching the behavior
 * of events-ex and util-ex.
 */
import { describe, expect, it } from 'vitest'
import { normalizeEventPattern } from '../src/utils/event-pattern'

describe('normalizeEventPattern', () => {
  // ── String-form RegExp patterns ────────────────────────────────
  it('should convert "/group:.*/" to RegExp', () => {
    const result = normalizeEventPattern('/group:.*/')
    expect(result).toBeInstanceOf(RegExp)
    expect((result as RegExp).source).toBe('group:.*')
    expect((result as RegExp).flags).toBe('')
  })

  it('should convert "/group:.*/gi" with flags', () => {
    const result = normalizeEventPattern('/group:.*/gi')
    expect(result).toBeInstanceOf(RegExp)
    expect((result as RegExp).source).toBe('group:.*')
    expect((result as RegExp).flags).toBe('gi')
  })

  it('should convert "/^data:\\d+$/" with anchors and quantifiers', () => {
    const result = normalizeEventPattern('/^data:\\d+$/')
    expect(result).toBeInstanceOf(RegExp)
    expect((result as RegExp).test('data:123')).toBe(true)
    expect((result as RegExp).test('data:abc')).toBe(false)
  })

  it('should convert "/(error|warning):.*/" with alternation', () => {
    const result = normalizeEventPattern('/(error|warning):.*/')
    expect(result).toBeInstanceOf(RegExp)
    expect((result as RegExp).test('error:disk-full')).toBe(true)
    expect((result as RegExp).test('warning:memory-low')).toBe(true)
    expect((result as RegExp).test('info:startup')).toBe(false)
  })

  // ── Plain string patterns (not RegExp) ─────────────────────────
  it('should return plain string unchanged "group:one"', () => {
    const result = normalizeEventPattern('group:one')
    expect(result).toBe('group:one')
  })

  it('should return empty string unchanged', () => {
    const result = normalizeEventPattern('')
    expect(result).toBe('')
  })

  it('should return single-character string unchanged', () => {
    const result = normalizeEventPattern('a')
    expect(result).toBe('a')
  })

  // ── Edge cases ─────────────────────────────────────────────────
  it('should treat "//" as invalid (not a regex since no content)', () => {
    // isRegExpStr requires length > 2 + starts with / + lastIndexOf('/') > 0
    // '//' has length 2, so it's NOT a regex string
    const result = normalizeEventPattern('//')
    expect(result).toBe('//')
  })

  it('should treat "/no-closing-slash" as plain string', () => {
    // lastIndexOf('/') === 0, so not a regex string
    const result = normalizeEventPattern('/no-closing-slash')
    expect(result).toBe('/no-closing-slash')
  })

  it('should convert "/pattern/" (single char pattern) to RegExp', () => {
    const result = normalizeEventPattern('/a/')
    expect(result).toBeInstanceOf(RegExp)
    expect((result as RegExp).source).toBe('a')
  })

  // ── Edge case: patterns that look like regex but aren't ────────
  it('should treat "/[/" as plain string (unclosed bracket)', () => {
    const result = normalizeEventPattern('/[/')
    expect(result).toBe('/[/')
  })

  it('should treat "/no-close" as plain string (no closing slash)', () => {
    const result = normalizeEventPattern('/no-close')
    expect(result).toBe('/no-close')
  })

  // ── Edge case: NEVER throws ────────────────────────────────────
  it('should NOT throw for any pattern input', () => {
    // isRegExpStr from util-ex is very conservative — it only returns
    // true for well-formed /pattern/ strings.
    // All edge cases are treated as plain strings.
    const safePatterns = [
      '/[/',       // unclosed bracket
      '/(',        // unclosed group
      '//',        // empty content  
      '',
      '/no-close', // no closing slash
      '/(unclosed',
      '/\\/',      // escaped closing slash
      '/\\\\/',    // backslash
    ]
    for (const pattern of safePatterns) {
      expect(() => normalizeEventPattern(pattern)).not.toThrow()
      const result = normalizeEventPattern(pattern)
      expect(typeof result === 'string' || result instanceof RegExp).toBe(true)
    }
  })

  it('should NOT throw for well-formed regex patterns', () => {
    const regexPatterns = [
      '/a/',
      '/group:.*/',
      '/^data:\\d+$/',
      '/(error|warning):.*/',
      '/.*/',
    ]
    for (const pattern of regexPatterns) {
      expect(() => normalizeEventPattern(pattern)).not.toThrow()
      const result = normalizeEventPattern(pattern)
      expect(result).toBeInstanceOf(RegExp)
    }
  })

  // ── Matching behavior ──────────────────────────────────────────
  it('should match group:one against /group:.*/ pattern', () => {
    const pattern = normalizeEventPattern('/group:.*/')
    expect(pattern).toBeInstanceOf(RegExp)
    expect((pattern as RegExp).test('group:one')).toBe(true)
    expect((pattern as RegExp).test('group:two')).toBe(true)
    expect((pattern as RegExp).test('group:')).toBe(true)
    // 'group' without colon does NOT match /group:.*/ (requires 'group:' prefix)
    expect((pattern as RegExp).test('group')).toBe(false)
    expect((pattern as RegExp).test('other:one')).toBe(false)
  })

  it('should match exact string "group:one" only', () => {
    const pattern = normalizeEventPattern('group:one')
    expect(pattern).toBe('group:one')
    // plain string exact comparison
    expect(pattern === 'group:one').toBe(true)
    expect(pattern === 'group:two').toBe(false)
  })

  it('should match case-insensitively with /group:.*/i', () => {
    const pattern = normalizeEventPattern('/group:.*/i')
    expect(pattern).toBeInstanceOf(RegExp)
    expect((pattern as RegExp).test('GROUP:ONE')).toBe(true)
    expect((pattern as RegExp).test('Group:Two')).toBe(true)
  })

  it('should work with numeric-only event names', () => {
    const exact = normalizeEventPattern('123')
    expect(exact).toBe('123')

    const regex = normalizeEventPattern('/^\\d+$/')
    expect(regex).toBeInstanceOf(RegExp)
    expect((regex as RegExp).test('123')).toBe(true)
    expect((regex as RegExp).test('abc')).toBe(false)
  })
})
