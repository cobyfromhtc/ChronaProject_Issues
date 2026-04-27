/**
 * PostImages API Integration Service
 *
 * Provides image upload functionality via the PostImages API (https://postimages.org/).
 * Supports round-robin API key selection for load distribution and includes
 * automatic fallback to the next key on failure.
 *
 * API Endpoints (tried in order):
 * 1. https://postimages.org/api (official API endpoint - multipart form)
 * 2. https://postimages.org/api (JSON payload)
 * 3. https://api.postimages.org/v1/upload (legacy - redirects to #1)
 *
 * - Requires API keys (configured via environment variables)
 * - Supports multipart/form-data and JSON uploads
 * - Returns image URLs in various formats
 *
 * When no API keys are configured or all keys fail, the service gracefully
 * falls back to local storage.
 */

import { deflateSync, crc32 } from 'zlib'

// ===========================================
// Configuration
// ===========================================

/** Number of API key slots */
const API_KEY_COUNT = 10

/** PostImages API upload endpoints (tried in order) */
const POSTIMAGES_ENDPOINTS = [
  'https://postimages.org/api',
  'https://api.postimages.org/v1/upload',
] as const

/** Maximum file size for PostImages uploads (24MB) */
const POSTIMAGES_MAX_FILE_SIZE = 24 * 1024 * 1024

/** Maximum number of retry attempts across different keys */
const MAX_RETRY_ATTEMPTS = 3

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 30000

// ===========================================
// Upload Type Definitions
// ===========================================

export type UploadType = 'avatar' | 'banner' | 'storyline_icon' | 'message_image'

/** Maps upload types to folder prefixes for organization */
const UPLOAD_TYPE_FOLDERS: Record<UploadType, string> = {
  avatar: 'avatars',
  banner: 'banners',
  storyline_icon: 'icons',
  message_image: 'messages',
}

// ===========================================
// API Key Management
// ===========================================

/**
 * Retrieves all configured PostImages API keys from environment variables.
 * Keys are expected as POSTIMAGES_API_KEY_1 through POSTIMAGES_API_KEY_10.
 * Empty or unset keys are filtered out.
 */
function getConfiguredKeys(): string[] {
  const keys: string[] = []
  for (let i = 1; i <= API_KEY_COUNT; i++) {
    const key = process.env[`POSTIMAGES_API_KEY_${i}`]
    if (key && key.trim() !== '') {
      keys.push(key.trim())
    }
  }
  return keys
}

/** Check if any PostImages API keys are configured */
export function isPostImagesConfigured(): boolean {
  return getConfiguredKeys().length > 0
}

// ===========================================
// Round-Robin Key Selection
// ===========================================

/** Current index for round-robin selection (module-level state) */
let currentKeyIndex = 0

/**
 * Selects the next API key using round-robin distribution.
 * This ensures load is spread evenly across all configured keys.
 */
function getNextKey(): string | null {
  const keys = getConfiguredKeys()
  if (keys.length === 0) return null

  const key = keys[currentKeyIndex % keys.length]
  currentKeyIndex = (currentKeyIndex + 1) % keys.length
  return key
}

/**
 * Reset the round-robin index (useful for testing)
 */
export function resetRoundRobinIndex(): void {
  currentKeyIndex = 0
}

// ===========================================
// PostImages API Response Types
// ===========================================

export interface PostImagesUploadResult {
  url: string
  originalUrl?: string
  thumbnailUrl?: string
  mediumUrl?: string
  deleteUrl?: string
  key: string
  storage: 'postimages'
}

export interface PostImagesErrorResponse {
  error: string
  statusCode: number
  keyIndex?: number
}

// ===========================================
// Upload Function
// ===========================================

/**
 * Upload an image to PostImages API.
 *
 * Uses round-robin key selection and retries with different keys on failure.
 * Tries multiple upload methods (multipart form, JSON) and endpoints.
 * If all attempts fail, throws an error so the caller can fall back to local storage.
 *
 * @param fileBuffer - The image file as a Buffer
 * @param filename - Original filename (used for content type detection)
 * @param uploadType - The type of upload (affects folder organization)
 * @returns PostImagesUploadResult on success, throws on failure
 */
export async function uploadToPostImages(
  fileBuffer: Buffer,
  filename: string,
  uploadType: UploadType = 'avatar'
): Promise<PostImagesUploadResult> {
  const keys = getConfiguredKeys()

  if (keys.length === 0) {
    throw new Error(
      '[PostImages] No API keys configured. Set POSTIMAGES_API_KEY_1 through POSTIMAGES_API_KEY_10 in your environment.'
    )
  }

  if (fileBuffer.length > POSTIMAGES_MAX_FILE_SIZE) {
    throw new Error(
      `[PostImages] File size (${fileBuffer.length} bytes) exceeds maximum allowed size (${POSTIMAGES_MAX_FILE_SIZE} bytes).`
    )
  }

  // Determine content type from filename
  const contentType = getContentType(filename)

  // Try up to MAX_RETRY_ATTEMPTS with different keys
  const errors: PostImagesErrorResponse[] = []

  for (let attempt = 0; attempt < Math.min(MAX_RETRY_ATTEMPTS, keys.length); attempt++) {
    const apiKey = getNextKey()
    if (!apiKey) {
      throw new Error('[PostImages] No API key available for round-robin selection.')
    }

    const keyIndex = keys.indexOf(apiKey) + 1

    try {
      const result = await performUpload(fileBuffer, filename, contentType, apiKey, uploadType)
      console.log(`[PostImages] Upload successful using key #${keyIndex} (attempt ${attempt + 1})`)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.warn(
        `[PostImages] Upload failed with key #${keyIndex} (attempt ${attempt + 1}): ${errorMessage}`
      )
      errors.push({
        error: errorMessage,
        statusCode: 0,
        keyIndex,
      })
    }
  }

  // All attempts failed
  const errorSummary = errors
    .map((e) => `Key #${e.keyIndex}: ${e.error}`)
    .join('; ')
  throw new Error(
    `[PostImages] All ${errors.length} upload attempts failed. Errors: ${errorSummary}`
  )
}

/**
 * Perform a single upload attempt to PostImages.
 * Tries multipart form data first, then JSON payload.
 */
async function performUpload(
  fileBuffer: Buffer,
  filename: string,
  contentType: string,
  apiKey: string,
  uploadType: UploadType
): Promise<PostImagesUploadResult> {
  const folder = UPLOAD_TYPE_FOLDERS[uploadType]
  let lastError: Error | null = null

  // Try each endpoint
  for (const endpoint of POSTIMAGES_ENDPOINTS) {
    // Method 1: Multipart form data
    try {
      const result = await uploadMultipart(fileBuffer, filename, contentType, apiKey, folder, endpoint)
      return result
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn(`[PostImages] Multipart upload to ${endpoint} failed: ${lastError.message}`)
    }

    // Method 2: JSON with base64 data URI
    try {
      const result = await uploadJson(fileBuffer, filename, contentType, apiKey, folder, endpoint)
      return result
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn(`[PostImages] JSON upload to ${endpoint} failed: ${lastError.message}`)
    }
  }

  throw lastError || new Error('[PostImages] All upload methods failed')
}

/**
 * Upload using multipart/form-data (standard file upload approach).
 */
async function uploadMultipart(
  fileBuffer: Buffer,
  filename: string,
  contentType: string,
  apiKey: string,
  folder: string,
  endpoint: string
): Promise<PostImagesUploadResult> {
  const formData = new FormData()
  const blob = new Blob([fileBuffer], { type: contentType })
  formData.append('file', blob, filename)
  formData.append('key', apiKey)
  formData.append('token', apiKey) // Some API versions use 'token' instead of 'key'
  formData.append('optsize', '0')
  formData.append('expire', '0')

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
      redirect: 'follow',
    })

    return await handleResponse(response, folder)
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Upload using JSON with base64-encoded image data.
 */
async function uploadJson(
  fileBuffer: Buffer,
  filename: string,
  contentType: string,
  apiKey: string,
  folder: string,
  endpoint: string
): Promise<PostImagesUploadResult> {
  const base64Data = fileBuffer.toString('base64')
  const dataUri = `data:${contentType};base64,${base64Data}`

  const requestBody = JSON.stringify({
    key: apiKey,
    token: apiKey,
    image: dataUri,
    optsize: '0',
    expire: '0',
    original_filename: filename,
  })

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: requestBody,
      signal: controller.signal,
      redirect: 'follow',
    })

    return await handleResponse(response, folder)
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Handle the PostImages API response.
 * Validates the response and parses it into a PostImagesUploadResult.
 */
async function handleResponse(
  response: Response,
  folder: string
): Promise<PostImagesUploadResult> {
  if (!response.ok) {
    const responseText = await response.text().catch(() => '')
    throw new Error(
      `HTTP ${response.status}: ${responseText || response.statusText}`
    )
  }

  const responseText = await response.text()

  if (!responseText || responseText.trim() === '') {
    throw new Error(
      'Empty response from PostImages API. The API key may be invalid or the API endpoint may have changed. ' +
      'Please verify your API keys at https://postimages.org/ and check for API documentation updates.'
    )
  }

  return parsePostImagesResponse(responseText, folder)
}

/**
 * Parse the PostImages API response.
 * The API may return different formats depending on the endpoint version.
 */
function parsePostImagesResponse(
  responseText: string,
  folder: string
): PostImagesUploadResult {
  // Try JSON parsing first
  try {
    const json = JSON.parse(responseText)

    // Handle error responses
    if (json.error) {
      throw new Error(`API error: ${json.error.message || json.error}`)
    }

    // Handle various PostImages response formats
    if (json.url) {
      return {
        url: json.url,
        originalUrl: json.original || json.url,
        thumbnailUrl: json.thumb_url || json.thumb || undefined,
        mediumUrl: json.medium_url || json.medium || undefined,
        deleteUrl: json.delete_url || json.delete || undefined,
        key: `${folder}/${extractFilenameFromUrl(json.url)}`,
        storage: 'postimages',
      }
    }

    // Some API versions nest the data
    if (json.data?.url) {
      return {
        url: json.data.url,
        originalUrl: json.data.original || json.data.url,
        thumbnailUrl: json.data.thumb_url || json.data.thumb || undefined,
        mediumUrl: json.data.medium_url || json.data.medium || undefined,
        deleteUrl: json.data.delete_url || json.data.delete || undefined,
        key: `${folder}/${extractFilenameFromUrl(json.data.url)}`,
        storage: 'postimages',
      }
    }

    // Check for common alternative response formats
    if (json.image_url) {
      return {
        url: json.image_url,
        originalUrl: json.original_url || json.image_url,
        thumbnailUrl: json.thumb_url || undefined,
        mediumUrl: json.medium_url || undefined,
        key: `${folder}/${extractFilenameFromUrl(json.image_url)}`,
        storage: 'postimages',
      }
    }

    // If we got JSON but couldn't find a URL, throw
    throw new Error(`Unexpected JSON response format: ${responseText.substring(0, 200)}`)
  } catch (parseError) {
    // If JSON parsing failed, check if the response is a plain URL
    const trimmed = responseText.trim()
    if (trimmed.startsWith('http')) {
      return {
        url: trimmed,
        key: `${folder}/${extractFilenameFromUrl(trimmed)}`,
        storage: 'postimages',
      }
    }

    // Re-throw if it was a JSON parse error with context
    if (parseError instanceof Error && (
      parseError.message.includes('Unexpected JSON') ||
      parseError.message.includes('API error')
    )) {
      throw parseError
    }

    throw new Error(
      `Failed to parse PostImages response: ${responseText.substring(0, 200)}`
    )
  }
}

// ===========================================
// Utility Functions
// ===========================================

/**
 * Determine content type from filename extension.
 */
function getContentType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop()
  const contentTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
  }
  return contentTypes[ext || ''] || 'image/png'
}

/**
 * Extract filename from a URL path.
 */
function extractFilenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const parts = pathname.split('/')
    return parts[parts.length - 1] || `upload-${Date.now()}`
  } catch {
    return `upload-${Date.now()}`
  }
}

// ===========================================
// Status & Health Check
// ===========================================

export interface PostImagesStatus {
  configured: boolean
  keyCount: number
  currentKeyIndex: number
  maxFileSize: number
  uploadTypes: UploadType[]
  endpoints: string[]
}

/**
 * Get the current status of the PostImages service configuration.
 * Useful for admin dashboards and diagnostics.
 */
export function getPostImagesStatus(): PostImagesStatus {
  const keys = getConfiguredKeys()
  return {
    configured: keys.length > 0,
    keyCount: keys.length,
    currentKeyIndex,
    maxFileSize: POSTIMAGES_MAX_FILE_SIZE,
    uploadTypes: ['avatar', 'banner', 'storyline_icon', 'message_image'],
    endpoints: [...POSTIMAGES_ENDPOINTS],
  }
}

/**
 * Test the PostImages API connectivity by attempting a small upload.
 * Returns the result of the test upload or an error.
 */
export async function testPostImagesConnection(): Promise<{
  success: boolean
  message: string
  uploadResult?: PostImagesUploadResult
  status?: PostImagesStatus
}> {
  const status = getPostImagesStatus()

  if (!status.configured) {
    return {
      success: false,
      message:
        'PostImages API is not configured. Set POSTIMAGES_API_KEY_1 through POSTIMAGES_API_KEY_10 environment variables.',
      status,
    }
  }

  // Create a minimal 1x1 PNG for testing
  const testPng = createTestPng()

  try {
    const result = await uploadToPostImages(testPng, 'test-connection.png', 'avatar')
    return {
      success: true,
      message: `Successfully uploaded test image. URL: ${result.url}`,
      uploadResult: result,
      status,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      message: `PostImages API test failed: ${errorMessage}`,
      status,
    }
  }
}

/**
 * Create a minimal 1x1 red PNG for testing purposes.
 */
function createTestPng(): Buffer {
  // Minimal valid PNG: 1x1 red pixel
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR chunk
  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(1, 0) // width
  ihdrData.writeUInt32BE(1, 4) // height
  ihdrData[8] = 8 // bit depth
  ihdrData[9] = 2 // color type (RGB)
  ihdrData[10] = 0 // compression
  ihdrData[11] = 0 // filter
  ihdrData[12] = 0 // interlace
  const ihdr = createPngChunk('IHDR', ihdrData)

  // IDAT chunk - compressed image data
  const rawData = Buffer.from([0, 255, 0, 0]) // filter byte + RGB
  const compressed = deflateSync(rawData)
  const idat = createPngChunk('IDAT', compressed)

  // IEND chunk
  const iend = createPngChunk('IEND', Buffer.alloc(0))

  return Buffer.concat([signature, ihdr, idat, iend])
}

/**
 * Create a PNG chunk with proper CRC.
 */
function createPngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)

  const typeBuffer = Buffer.from(type, 'ascii')
  const crcInput = Buffer.concat([typeBuffer, data])

  const crcVal = crc32(crcInput)
  const crcBuffer = Buffer.alloc(4)
  crcBuffer.writeUInt32BE(crcVal >>> 0, 0)

  return Buffer.concat([length, typeBuffer, data, crcBuffer])
}
