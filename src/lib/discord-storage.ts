/**
 * Discord Webhook Image Storage Service
 *
 * Provides image upload functionality via Discord webhooks.
 * When a user uploads an image, it is sent to a Discord channel via webhook,
 * and the Discord CDN URL is used as the image source.
 *
 * A unique image code (e.g., "cfgnjbeubebeuvbe") is generated for each upload,
 * allowing images to be referenced via `/api/images/{code}`.
 *
 * When Discord webhook is not configured, uploads still work normally
 * (just skip the Discord step).
 */

import crypto from 'crypto'
import { deflateSync } from 'zlib'
import { db } from '@/lib/db'

// ===========================================
// Configuration
// ===========================================

/** Maximum file size for Discord webhook uploads (25MB Discord limit) */
const DISCORD_MAX_FILE_SIZE = 25 * 1024 * 1024

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 30000

// ===========================================
// Type Definitions
// ===========================================

export interface DiscordUploadResult {
  /** The Discord CDN URL for the uploaded image */
  url: string
  /** Unique 20-char alphanumeric code for the image */
  code: string
  /** The original Discord message URL (for reference) */
  discordUrl: string
}

export interface DiscordUploadError {
  error: string
  details?: string
}

// ===========================================
// Configuration Check
// ===========================================

/**
 * Check if the Discord webhook is configured.
 * Returns true if DISCORD_WEBHOOK_URL is set in environment variables.
 */
export function isDiscordConfigured(): boolean {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  return !!(webhookUrl && webhookUrl.trim() !== '' && webhookUrl.startsWith('https://'))
}

/**
 * Get the Discord webhook URL from environment variables.
 * Returns null if not configured.
 */
function getWebhookUrl(): string | null {
  const url = process.env.DISCORD_WEBHOOK_URL
  if (!url || url.trim() === '' || !url.startsWith('https://')) {
    return null
  }
  return url.trim()
}

// ===========================================
// Code Generation
// ===========================================

/**
 * Generate a unique 20-character alphanumeric code for an image.
 * Uses crypto.randomBytes with base64url encoding (URL-safe characters).
 *
 * Example: "cfgnjbeubebeuvbeABCD"
 */
export function generateImageCode(): string {
  return crypto.randomBytes(15).toString('base64url').slice(0, 20)
}

/**
 * Generate a unique image code that doesn't collide with existing records.
 * Retries up to maxAttempts times.
 */
export async function generateUniqueImageCode(maxAttempts: number = 10): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateImageCode()
    const existing = await db.imageRecord.findUnique({ where: { code } })
    if (!existing) {
      return code
    }
    console.warn(`[Discord Storage] Image code collision detected, retrying (${i + 1}/${maxAttempts})`)
  }
  throw new Error(`[Discord Storage] Failed to generate unique image code after ${maxAttempts} attempts`)
}

// ===========================================
// Upload Function
// ===========================================

/**
 * Upload an image to Discord via webhook.
 *
 * Sends the image as a FormData attachment to the Discord webhook URL.
 * The message content includes the generated code for reference.
 * Extracts the CDN URL from the Discord response.
 *
 * Falls back gracefully if webhook is not configured.
 *
 * @param buffer - The image file as a Buffer
 * @param fileName - The original filename
 * @param uploadType - The type of upload (avatar, banner, etc.)
 * @returns DiscordUploadResult on success, throws on failure
 */
export async function uploadToDiscord(
  buffer: Buffer,
  fileName: string,
  uploadType: string
): Promise<DiscordUploadResult> {
  const webhookUrl = getWebhookUrl()

  if (!webhookUrl) {
    throw new Error(
      '[Discord Storage] DISCORD_WEBHOOK_URL is not configured. ' +
      'Set the DISCORD_WEBHOOK_URL environment variable to enable Discord image storage.'
    )
  }

  if (buffer.length > DISCORD_MAX_FILE_SIZE) {
    throw new Error(
      `[Discord Storage] File size (${buffer.length} bytes) exceeds Discord's maximum allowed size (${DISCORD_MAX_FILE_SIZE} bytes).`
    )
  }

  // Generate unique code for this image
  const code = await generateUniqueImageCode()

  // Build FormData for Discord webhook
  const formData = new FormData()
  const blob = new Blob([buffer], { type: getContentType(fileName) })
  formData.append('file', blob, fileName)

  // Message content includes the code for reference
  formData.append(
    'content',
    `📷 **Image Upload** | Type: \`${uploadType}\` | Code: \`${code}\` | File: \`${fileName}\``
  )

  // Add thread_name if we want to organize by upload type (optional)
  // formData.append('thread_name', `Uploads - ${uploadType}`)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    console.log(`[Discord Storage] Uploading ${fileName} (${uploadType}, code: ${code})`)

    const response = await fetch(webhookUrl, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(
        `Discord webhook returned HTTP ${response.status}: ${errorText || response.statusText}`
      )
    }

    const responseData = await response.json()

    // Extract the CDN URL from the Discord response
    const cdnUrl = extractCdnUrl(responseData, fileName)

    if (!cdnUrl) {
      throw new Error(
        `[Discord Storage] Could not extract CDN URL from Discord response. ` +
        `Response keys: ${Object.keys(responseData).join(', ')}`
      )
    }

    // Extract the Discord message URL
    const discordMessageUrl = extractMessageUrl(responseData)

    console.log(`[Discord Storage] Upload successful: code=${code}, url=${cdnUrl}`)

    return {
      url: cdnUrl,
      code,
      discordUrl: discordMessageUrl || '',
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('[Discord Storage] Upload request timed out')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

// ===========================================
// Discord Response Parsing
// ===========================================

/**
 * Extract the CDN URL from a Discord webhook response.
 *
 * Discord webhook responses include attachments with CDN URLs.
 * The URL format is typically:
 * https://cdn.discordapp.com/attachments/{channel_id}/{message_id}/{filename}
 *
 * We prefer the CDN URL over the proxy URL for permanence.
 */
function extractCdnUrl(responseData: Record<string, unknown>, fileName: string): string | null {
  // Try to get URL from attachments array
  const attachments = responseData.attachments as Array<Record<string, unknown>> | undefined

  if (attachments && Array.isArray(attachments) && attachments.length > 0) {
    const attachment = attachments[0]

    // Prefer the direct CDN URL
    if (typeof attachment.url === 'string') {
      return attachment.url
    }

    // Fallback to proxy URL
    if (typeof attachment.proxy_url === 'string') {
      return attachment.proxy_url
    }
  }

  // Try to construct from message channel/id if available
  if (responseData.channel_id && responseData.id) {
    // This is a best-effort construction
    const channelId = responseData.channel_id as string
    const messageId = responseData.id as string
    // Note: The actual filename in Discord may differ, so this might not always work
    return `https://cdn.discordapp.com/attachments/${channelId}/${messageId}/${fileName}`
  }

  return null
}

/**
 * Extract the Discord message URL from a webhook response.
 */
function extractMessageUrl(responseData: Record<string, unknown>): string | null {
  // Discord sometimes includes the jump URL
  if (typeof responseData.jump_url === 'string') {
    return responseData.jump_url
  }

  // Construct from channel_id, guild_id, and id
  if (responseData.guild_id && responseData.channel_id && responseData.id) {
    return `https://discord.com/channels/${responseData.guild_id}/${responseData.channel_id}/${responseData.id}`
  }

  return null
}

// ===========================================
// Database Operations
// ===========================================

/**
 * Save an image record to the database.
 * This creates a mapping between the code and the image URLs.
 */
export async function saveImageRecord(params: {
  code: string
  url: string
  discordUrl: string
  fileName: string
  fileType: string
  fileSize: number
  uploadedBy: string
  uploadType: string
}): Promise<void> {
  await db.imageRecord.create({
    data: {
      code: params.code,
      url: params.url,
      discordUrl: params.discordUrl,
      fileName: params.fileName,
      fileType: params.fileType,
      fileSize: params.fileSize,
      uploadedBy: params.uploadedBy,
      uploadType: params.uploadType,
    },
  })
}

/**
 * Look up an image record by code.
 * Returns the record or null if not found.
 */
export async function getImageByCode(code: string): Promise<{
  url: string
  discordUrl: string
  fileName: string
  fileType: string
  uploadType: string
  createdAt: Date
} | null> {
  const record = await db.imageRecord.findUnique({
    where: { code },
    select: {
      url: true,
      discordUrl: true,
      fileName: true,
      fileType: true,
      uploadType: true,
      createdAt: true,
    },
  })

  return record
}

/**
 * Look up image records by user.
 */
export async function getImagesByUser(
  userId: string,
  options?: { uploadType?: string; limit?: number; offset?: number }
): Promise<Array<{
  code: string
  url: string
  discordUrl: string
  fileName: string
  fileType: string
  uploadType: string
  createdAt: Date
}>> {
  const records = await db.imageRecord.findMany({
    where: {
      uploadedBy: userId,
      ...(options?.uploadType ? { uploadType: options.uploadType } : {}),
    },
    select: {
      code: true,
      url: true,
      discordUrl: true,
      fileName: true,
      fileType: true,
      uploadType: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 50,
    skip: options?.offset || 0,
  })

  return records
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
  return contentTypes[ext || ''] || 'application/octet-stream'
}

// ===========================================
// Status & Health Check
// ===========================================

export interface DiscordStorageStatus {
  configured: boolean
  webhookUrlSet: boolean
  maxFileSize: number
  uploadTypes: string[]
}

/**
 * Get the current status of the Discord storage configuration.
 * Useful for admin dashboards and diagnostics.
 */
export function getDiscordStorageStatus(): DiscordStorageStatus {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  return {
    configured: isDiscordConfigured(),
    webhookUrlSet: !!(webhookUrl && webhookUrl.trim() !== ''),
    maxFileSize: DISCORD_MAX_FILE_SIZE,
    uploadTypes: ['avatar', 'banner', 'storyline_icon', 'message_image'],
  }
}

/**
 * Test the Discord webhook connection by sending a small test image.
 * Returns the result of the test upload or an error.
 */
export async function testDiscordConnection(): Promise<{
  success: boolean
  message: string
  uploadResult?: DiscordUploadResult
  status?: DiscordStorageStatus
}> {
  const status = getDiscordStorageStatus()

  if (!status.configured) {
    return {
      success: false,
      message:
        'Discord webhook is not configured. Set DISCORD_WEBHOOK_URL environment variable.',
      status,
    }
  }

  // Create a minimal 1x1 PNG for testing
  const testPng = createTestPng()

  try {
    const result = await uploadToDiscord(testPng, 'test-connection.png', 'test')
    return {
      success: true,
      message: `Successfully uploaded test image to Discord. Code: ${result.code}, URL: ${result.url}`,
      uploadResult: result,
      status,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      message: `Discord webhook test failed: ${errorMessage}`,
      status,
    }
  }
}

/**
 * Create a minimal 1x1 PNG for testing purposes.
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

  // Build IHDR chunk with length + type + data + CRC
  const ihdrType = Buffer.from('IHDR', 'ascii')
  const ihdrCrcInput = Buffer.concat([ihdrType, ihdrData])
  const ihdrCrc = crc32(ihdrCrcInput)
  const ihdrLength = Buffer.alloc(4)
  ihdrLength.writeUInt32BE(ihdrData.length, 0)
  const ihdrCrcBuf = Buffer.alloc(4)
  ihdrCrcBuf.writeUInt32BE(ihdrCrc >>> 0, 0)
  const ihdr = Buffer.concat([ihdrLength, ihdrType, ihdrData, ihdrCrcBuf])

  // IDAT chunk - raw image data (filter byte + 1 RGB pixel)
  const rawData = Buffer.from([0, 255, 0, 0]) // filter byte + RGB
  const compressed = deflateSync(rawData)
  const idatType = Buffer.from('IDAT', 'ascii')
  const idatCrcInput = Buffer.concat([idatType, compressed])
  const idatCrc = crc32(idatCrcInput)
  const idatLength = Buffer.alloc(4)
  idatLength.writeUInt32BE(compressed.length, 0)
  const idatCrcBuf = Buffer.alloc(4)
  idatCrcBuf.writeUInt32BE(idatCrc >>> 0, 0)
  const idat = Buffer.concat([idatLength, idatType, compressed, idatCrcBuf])

  // IEND chunk
  const iendData = Buffer.alloc(0)
  const iendType = Buffer.from('IEND', 'ascii')
  const iendCrcInput = Buffer.concat([iendType, iendData])
  const iendCrc = crc32(iendCrcInput)
  const iendLength = Buffer.alloc(4)
  iendLength.writeUInt32BE(0, 0)
  const iendCrcBuf = Buffer.alloc(4)
  iendCrcBuf.writeUInt32BE(iendCrc >>> 0, 0)
  const iend = Buffer.concat([iendLength, iendType, iendData, iendCrcBuf])

  return Buffer.concat([signature, ihdr, idat, iend])
}

/**
 * Simple CRC32 implementation for PNG chunk checksums.
 */
function crc32(buf: Buffer): number {
  // CRC32 lookup table
  const table: number[] = []
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      if (c & 1) {
        c = 0xedb88320 ^ (c >>> 1)
      } else {
        c = c >>> 1
      }
    }
    table[i] = c
  }

  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}
