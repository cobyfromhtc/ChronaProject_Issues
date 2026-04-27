import { NextRequest, NextResponse } from 'next/server'
import { getImageByCode } from '@/lib/discord-storage'

/**
 * GET /api/images/[code]
 * Resolve an image code to its URL and redirect.
 *
 * This allows using `/api/images/cfgnjbeubebeuvbe` as an image URL,
 * which will redirect to the actual CDN URL (Discord, PostImages, or local).
 *
 * Query parameters:
 * - json: If set to "true", returns JSON with image metadata instead of redirecting
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params

    if (!code || code.trim() === '') {
      return NextResponse.json(
        { error: 'Image code is required' },
        { status: 400 }
      )
    }

    // Look up the image record by code
    const imageRecord = await getImageByCode(code)

    if (!imageRecord) {
      return NextResponse.json(
        { error: 'Image not found', code },
        { status: 404 }
      )
    }

    // Check if the client wants JSON metadata instead of a redirect
    const jsonResponse = request.nextUrl.searchParams.get('json')
    if (jsonResponse === 'true') {
      return NextResponse.json({
        code,
        url: imageRecord.url,
        discordUrl: imageRecord.discordUrl,
        fileName: imageRecord.fileName,
        fileType: imageRecord.fileType,
        uploadType: imageRecord.uploadType,
        createdAt: imageRecord.createdAt,
      })
    }

    // Redirect to the actual image URL
    // Prefer the primary URL (could be Discord CDN, PostImages, or local)
    const targetUrl = imageRecord.url

    // For local paths (starting with /uploads/), we can't redirect externally,
    // so we need to serve the file or redirect within the app
    if (targetUrl.startsWith('/uploads/')) {
      // Redirect to the local file path
      return NextResponse.redirect(new URL(targetUrl, request.url))
    }

    // For external URLs (Discord CDN, PostImages, etc.), redirect directly
    return NextResponse.redirect(targetUrl)
  } catch (error) {
    console.error('[Image Resolve] Error resolving image code:', error)
    return NextResponse.json(
      { error: 'Failed to resolve image' },
      { status: 500 }
    )
  }
}
