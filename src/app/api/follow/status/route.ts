import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { db } from '@/lib/db'

// GET - Get follow status and counts for a user
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionFromRequest(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get('targetUserId')
    
    if (!targetUserId) {
      return NextResponse.json(
        { error: 'Target user ID is required' },
        { status: 400 }
      )
    }
    
    // Get counts
    const [followersCount, followingCount] = await Promise.all([
      db.follow.count({
        where: { followingId: targetUserId }
      }),
      db.follow.count({
        where: { followerId: targetUserId }
      })
    ])
    
    // Check if current user is following this user
    let isFollowing = false
    if (user.id !== targetUserId) {
      const followRecord = await db.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: user.id,
            followingId: targetUserId
          }
        }
      })
      isFollowing = !!followRecord
    }
    
    return NextResponse.json({
      success: true,
      followersCount,
      followingCount,
      isFollowing,
      isOwnProfile: user.id === targetUserId
    })
  } catch (error) {
    console.error('Follow status error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
