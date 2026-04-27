/**
 * Storage abstraction layer for file uploads
 * Supports local filesystem, S3-compatible storage, and PostImages API
 */

import { writeFile, readFile, unlink, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import {
  isPostImagesConfigured,
  uploadToPostImages,
  type UploadType,
  type PostImagesUploadResult,
} from './postimages'
import { isDiscordConfigured, uploadToDiscord, type DiscordUploadResult } from './discord-storage'

// Storage type
export type StorageType = 'local' | 's3' | 'postimages' | 'discord'

// Configuration - Save to public/uploads so Next.js serves them as static files
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

// Upload result types
export interface LocalUploadResult {
  url: string
  key: string
  storage: 'local'
}

export interface PostImagesStorageResult extends PostImagesUploadResult {
  storage: 'postimages'
}

export interface DiscordStorageResult extends DiscordUploadResult {
  storage: 'discord'
}

export type UploadResult = LocalUploadResult | PostImagesStorageResult | DiscordStorageResult

// Check if S3 is configured
export function isS3Configured(): boolean {
  return !!(
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY &&
    process.env.S3_BUCKET_NAME &&
    process.env.S3_REGION &&
    process.env.S3_ENDPOINT
  )
}

// Get current storage type
export function getStorageType(): StorageType {
  if (isDiscordConfigured()) {
    return 'discord'
  }
  if (isPostImagesConfigured()) {
    return 'postimages'
  }
  if (isS3Configured()) {
    return 's3'
  }
  return 'local'
}

// Ensure upload directory exists
async function ensureUploadDir(): Promise<void> {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true })
  }
}

// Generate a unique filename
function generateFilename(originalName: string): string {
  const ext = path.extname(originalName)
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `${timestamp}-${random}${ext}`
}

/**
 * Upload a file using the best available storage method.
 * Prefers PostImages when configured, falls back to local storage.
 *
 * @param file - The file buffer
 * @param filename - Original filename
 * @param folder - Optional folder path (for local storage)
 * @param uploadType - The type of upload (for PostImages categorization)
 * @param forceStorage - Force a specific storage backend
 * @returns The URL or path to the uploaded file
 */
export async function uploadFile(
  file: Buffer,
  filename: string,
  folder?: string,
  uploadType: UploadType = 'avatar',
  forceStorage?: StorageType
): Promise<UploadResult> {
  const storageType = forceStorage || getStorageType()
  const key = folder ? `${folder}/${generateFilename(filename)}` : generateFilename(filename)

  if (storageType === 'postimages') {
    try {
      const result = await uploadToPostImages(file, filename, uploadType)
      return {
        ...result,
        storage: 'postimages',
      }
    } catch (error) {
      console.warn(
        '[Storage] PostImages upload failed, falling back to local storage:',
        error instanceof Error ? error.message : error
      )
      // Fall back to local storage
      return uploadToLocal(file, key)
    }
  } else if (storageType === 'discord') {
    try {
      const result = await uploadToDiscord(file, filename, uploadType)
      return {
        ...result,
        storage: 'discord',
      }
    } catch (error) {
      console.warn(
        '[Storage] Discord upload failed, falling back to local storage:',
        error instanceof Error ? error.message : error
      )
      // Fall back to local storage
      return uploadToLocal(file, key)
    }
  } else if (storageType === 's3') {
    return uploadToS3(file, key)
  } else {
    return uploadToLocal(file, key)
  }
}

/**
 * Upload an avatar image
 */
export async function uploadAvatar(
  file: Buffer,
  filename: string,
  userId: string
): Promise<UploadResult> {
  return uploadFile(file, filename, `avatars/${userId}`, 'avatar')
}

/**
 * Upload a banner image
 */
export async function uploadBanner(
  file: Buffer,
  filename: string,
  userId: string
): Promise<UploadResult> {
  return uploadFile(file, filename, `banners/${userId}`, 'banner')
}

/**
 * Upload a storyline icon
 */
export async function uploadStorylineIcon(
  file: Buffer,
  filename: string,
  storylineId: string
): Promise<UploadResult> {
  return uploadFile(file, filename, `icons/${storylineId}`, 'storyline_icon')
}

/**
 * Upload a message image
 */
export async function uploadMessageImage(
  file: Buffer,
  filename: string,
  messageId: string
): Promise<UploadResult> {
  return uploadFile(file, filename, `messages/${messageId}`, 'message_image')
}

/**
 * Upload to local filesystem
 */
async function uploadToLocal(file: Buffer, key: string): Promise<LocalUploadResult> {
  await ensureUploadDir()

  const filepath = path.join(UPLOAD_DIR, key)
  const dir = path.dirname(filepath)

  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }

  await writeFile(filepath, file)

  return {
    url: `/uploads/${key}`,
    key,
    storage: 'local',
  }
}

/**
 * Upload to S3-compatible storage
 */
async function uploadToS3(file: Buffer, key: string): Promise<UploadResult> {
  // S3 upload implementation
  // This would use AWS SDK or a similar library
  // For now, fall back to local storage

  console.warn('[Storage] S3 not fully configured, falling back to local storage')
  return uploadToLocal(file, key)
}

/**
 * Get a file
 */
export async function getFile(key: string): Promise<Buffer | null> {
  // For PostImages, files are hosted remotely and can't be retrieved as buffers
  // This is only for local/S3 storage
  const storageType = getStorageType()

  if (storageType === 'postimages') {
    // PostImages files are remote - can't retrieve as buffer
    console.warn('[Storage] Cannot retrieve PostImages files as buffer (remote storage)')
    return null
  }

  if (storageType === 's3') {
    return getFileFromS3(key)
  } else {
    return getFileFromLocal(key)
  }
}

/**
 * Get file from local filesystem
 */
async function getFileFromLocal(key: string): Promise<Buffer | null> {
  try {
    const filepath = path.join(UPLOAD_DIR, key)
    if (!existsSync(filepath)) {
      return null
    }
    return await readFile(filepath)
  } catch (error) {
    console.error('[Storage] Error reading file:', error)
    return null
  }
}

/**
 * Get file from S3
 */
async function getFileFromS3(key: string): Promise<Buffer | null> {
  // S3 get implementation
  console.warn('[Storage] S3 not fully configured, falling back to local storage')
  return getFileFromLocal(key)
}

/**
 * Delete a file
 */
export async function deleteFile(key: string): Promise<boolean> {
  // For PostImages, we can't delete remote files through the API easily
  // This is only for local/S3 storage
  const storageType = getStorageType()

  if (storageType === 'postimages') {
    console.warn('[Storage] Cannot delete PostImages files through API (remote storage)')
    return false
  }

  if (storageType === 's3') {
    return deleteFromS3(key)
  } else {
    return deleteFromLocal(key)
  }
}

/**
 * Delete from local filesystem
 */
async function deleteFromLocal(key: string): Promise<boolean> {
  try {
    const filepath = path.join(UPLOAD_DIR, key)
    if (!existsSync(filepath)) {
      return false
    }
    await unlink(filepath)
    return true
  } catch (error) {
    console.error('[Storage] Error deleting file:', error)
    return false
  }
}

/**
 * Delete from S3
 */
async function deleteFromS3(key: string): Promise<boolean> {
  // S3 delete implementation
  console.warn('[Storage] S3 not fully configured, falling back to local storage')
  return deleteFromLocal(key)
}

/**
 * Get public URL for a file
 */
export function getFileUrl(key: string): string {
  const storageType = getStorageType()

  if (storageType === 's3' && process.env.S3_PUBLIC_URL) {
    return `${process.env.S3_PUBLIC_URL}/${key}`
  }

  // For PostImages, the key IS the URL (it's already a full URL)
  if (storageType === 'postimages' && key.startsWith('http')) {
    return key
  }

  return `/uploads/${key}`
}
