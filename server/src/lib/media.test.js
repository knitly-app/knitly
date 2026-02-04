import { describe, it, expect } from 'bun:test'
import { validateUpload, validateImageDimensions, makeRawKey } from './media.js'

const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01])
const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D])
const gifBuffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00])
const webpBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])
const invalidBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])

describe('validateUpload', () => {
  describe('valid uploads', () => {
    it('accepts JPEG with correct content-type', () => {
      const result = validateUpload(jpegBuffer, 'image/jpeg', 'photo.jpg')
      expect(result.valid).toBe(true)
      expect(result.detectedFormat).toBe('jpeg')
      expect(result.errors).toEqual([])
    })

    it('accepts PNG with correct content-type', () => {
      const result = validateUpload(pngBuffer, 'image/png', 'image.png')
      expect(result.valid).toBe(true)
      expect(result.detectedFormat).toBe('png')
      expect(result.errors).toEqual([])
    })

    it('accepts GIF with correct content-type', () => {
      const result = validateUpload(gifBuffer, 'image/gif', 'animation.gif')
      expect(result.valid).toBe(true)
      expect(result.detectedFormat).toBe('gif')
      expect(result.errors).toEqual([])
    })

    it('accepts WebP with correct content-type', () => {
      const result = validateUpload(webpBuffer, 'image/webp', 'modern.webp')
      expect(result.valid).toBe(true)
      expect(result.detectedFormat).toBe('webp')
      expect(result.errors).toEqual([])
    })
  })

  describe('content-type mismatch', () => {
    it('rejects PNG bytes with image/jpeg content-type', () => {
      const result = validateUpload(pngBuffer, 'image/jpeg', 'fake.jpg')
      expect(result.valid).toBe(false)
      expect(result.detectedFormat).toBe('png')
      expect(result.errors).toContain('content_type_mismatch')
    })

    it('rejects JPEG bytes with image/png content-type', () => {
      const result = validateUpload(jpegBuffer, 'image/png', 'fake.png')
      expect(result.valid).toBe(false)
      expect(result.detectedFormat).toBe('jpeg')
      expect(result.errors).toContain('content_type_mismatch')
    })

    it('rejects GIF bytes with image/webp content-type', () => {
      const result = validateUpload(gifBuffer, 'image/webp', 'fake.webp')
      expect(result.valid).toBe(false)
      expect(result.detectedFormat).toBe('gif')
      expect(result.errors).toContain('content_type_mismatch')
    })
  })

  describe('extension mismatch', () => {
    it('rejects PNG bytes with .jpg extension', () => {
      const result = validateUpload(pngBuffer, 'image/png', 'sneaky.jpg')
      expect(result.valid).toBe(false)
      expect(result.detectedFormat).toBe('png')
      expect(result.errors).toContain('extension_mismatch')
    })

    it('rejects JPEG bytes with .png extension', () => {
      const result = validateUpload(jpegBuffer, 'image/jpeg', 'sneaky.png')
      expect(result.valid).toBe(false)
      expect(result.detectedFormat).toBe('jpeg')
      expect(result.errors).toContain('extension_mismatch')
    })

    it('rejects WebP bytes with .gif extension', () => {
      const result = validateUpload(webpBuffer, 'image/webp', 'sneaky.gif')
      expect(result.valid).toBe(false)
      expect(result.detectedFormat).toBe('webp')
      expect(result.errors).toContain('extension_mismatch')
    })
  })

  describe('invalid/unknown format', () => {
    it('rejects buffer with invalid magic bytes', () => {
      const result = validateUpload(invalidBuffer, 'image/jpeg', 'malicious.jpg')
      expect(result.valid).toBe(false)
      expect(result.detectedFormat).toBe(null)
      expect(result.errors).toContain('unrecognized_format')
    })

    it('rejects buffer that is too short', () => {
      const tinyBuffer = Buffer.from([0xFF, 0xD8])
      const result = validateUpload(tinyBuffer, 'image/jpeg', 'tiny.jpg')
      expect(result.valid).toBe(false)
      expect(result.detectedFormat).toBe(null)
      expect(result.errors).toContain('unrecognized_format')
    })

  })

  describe('edge cases', () => {
    it('accepts valid format with no filename', () => {
      const result = validateUpload(jpegBuffer, 'image/jpeg', null)
      expect(result.valid).toBe(true)
      expect(result.detectedFormat).toBe('jpeg')
    })

    it('accepts valid format with unknown content-type', () => {
      const result = validateUpload(jpegBuffer, 'application/octet-stream', 'photo.jpg')
      expect(result.valid).toBe(true)
      expect(result.detectedFormat).toBe('jpeg')
    })

    it('handles multiple errors (mismatch in both content-type and extension)', () => {
      const result = validateUpload(pngBuffer, 'image/jpeg', 'fake.gif')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('content_type_mismatch')
      expect(result.errors).toContain('extension_mismatch')
      expect(result.errors.length).toBe(2)
    })
  })
})

describe('makeRawKey', () => {
  describe('image content types', () => {
    it('returns .jpg for image/jpeg', () => {
      const key = makeRawKey(1, 'image/jpeg')
      expect(key.endsWith('.jpg')).toBe(true)
      expect(key.startsWith('raw/1/')).toBe(true)
    })

    it('returns .png for image/png', () => {
      const key = makeRawKey(1, 'image/png')
      expect(key.endsWith('.png')).toBe(true)
    })

    it('returns .webp for image/webp', () => {
      const key = makeRawKey(1, 'image/webp')
      expect(key.endsWith('.webp')).toBe(true)
    })

    it('returns .gif for image/gif', () => {
      const key = makeRawKey(1, 'image/gif')
      expect(key.endsWith('.gif')).toBe(true)
    })
  })

  describe('video content types', () => {
    it('returns .mp4 for video/mp4', () => {
      const key = makeRawKey(1, 'video/mp4')
      expect(key.endsWith('.mp4')).toBe(true)
      expect(key.startsWith('raw/1/')).toBe(true)
    })

    it('returns .mov for video/quicktime', () => {
      const key = makeRawKey(1, 'video/quicktime')
      expect(key.endsWith('.mov')).toBe(true)
    })

    it('returns .webm for video/webm', () => {
      const key = makeRawKey(1, 'video/webm')
      expect(key.endsWith('.webm')).toBe(true)
    })

    it('returns .m4v for video/x-m4v', () => {
      const key = makeRawKey(1, 'video/x-m4v')
      expect(key.endsWith('.m4v')).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('returns .jpg for unknown content type', () => {
      const key = makeRawKey(1, 'application/octet-stream')
      expect(key.endsWith('.jpg')).toBe(true)
    })

    it('generates unique keys for same user', () => {
      const key1 = makeRawKey(1, 'image/jpeg')
      const key2 = makeRawKey(1, 'image/jpeg')
      expect(key1).not.toBe(key2)
    })

    it('includes userId in path', () => {
      const key = makeRawKey(42, 'video/mp4')
      expect(key).toContain('/42/')
    })
  })
})
