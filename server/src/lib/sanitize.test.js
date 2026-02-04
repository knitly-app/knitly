import { describe, it, expect } from 'bun:test'
import { escapeHtml, sanitizeText, sanitizeSearchQuery } from './sanitize.js'

describe('escapeHtml', () => {
  it('escapes < to &lt;', () => {
    expect(escapeHtml('<')).toBe('&lt;')
    expect(escapeHtml('a<b')).toBe('a&lt;b')
  })

  it('escapes > to &gt;', () => {
    expect(escapeHtml('>')).toBe('&gt;')
    expect(escapeHtml('a>b')).toBe('a&gt;b')
  })

  it('escapes & to &amp;', () => {
    expect(escapeHtml('&')).toBe('&amp;')
    expect(escapeHtml('a&b')).toBe('a&amp;b')
  })

  it('escapes " to &quot;', () => {
    expect(escapeHtml('"')).toBe('&quot;')
    expect(escapeHtml('a"b')).toBe('a&quot;b')
  })

  it("escapes ' to &#x27;", () => {
    expect(escapeHtml("'")).toBe('&#x27;')
    expect(escapeHtml("a'b")).toBe('a&#x27;b')
  })

  it('returns non-strings unchanged', () => {
    expect(escapeHtml(42)).toBe(42)
    expect(escapeHtml(null)).toBe(null)
    expect(escapeHtml(undefined)).toBe(undefined)
    expect(escapeHtml({ foo: 'bar' })).toEqual({ foo: 'bar' })
  })

  it('handles empty strings', () => {
    expect(escapeHtml('')).toBe('')
  })

  it('escapes multiple characters', () => {
    expect(escapeHtml('<script>"test"</script>')).toBe('&lt;script&gt;&quot;test&quot;&lt;/script&gt;')
  })
})

describe('sanitizeText', () => {
  it('trims whitespace and escapes HTML', () => {
    expect(sanitizeText('  hello  ')).toBe('hello')
    expect(sanitizeText('  <b>bold</b>  ')).toBe('&lt;b&gt;bold&lt;/b&gt;')
  })

  it('returns empty string for null/undefined', () => {
    expect(sanitizeText(null)).toBe('')
    expect(sanitizeText(undefined)).toBe('')
  })

  it('returns empty string for non-strings', () => {
    expect(sanitizeText(42)).toBe('')
    expect(sanitizeText({})).toBe('')
  })

  it('neutralizes XSS payloads', () => {
    expect(sanitizeText('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(sanitizeText('<img onerror=alert(1)>')).toBe('&lt;img onerror=alert(1)&gt;')
    expect(sanitizeText('<a href="javascript:alert(1)">')).toBe('&lt;a href=&quot;javascript:alert(1)&quot;&gt;')
  })
})

describe('sanitizeSearchQuery', () => {
  it('trims whitespace and escapes HTML', () => {
    expect(sanitizeSearchQuery('  search term  ')).toBe('search term')
    expect(sanitizeSearchQuery('  <b>bold</b>  ')).toBe('&lt;b&gt;bold&lt;/b&gt;')
  })

  it('returns empty string for null/undefined', () => {
    expect(sanitizeSearchQuery(null)).toBe('')
    expect(sanitizeSearchQuery(undefined)).toBe('')
  })

  it('returns empty string for non-strings', () => {
    expect(sanitizeSearchQuery(42)).toBe('')
    expect(sanitizeSearchQuery({})).toBe('')
  })

  it('neutralizes XSS payloads', () => {
    expect(sanitizeSearchQuery('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(sanitizeSearchQuery('<img onerror=alert(1)>')).toBe('&lt;img onerror=alert(1)&gt;')
  })
})
