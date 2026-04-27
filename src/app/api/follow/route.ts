import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { db } from '@/lib/db'

// GET - Get followers or following list
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
    const type = searchParams.get('type') || 'following' // 'following' or 'followers'
    const userId = searchParams.get('userId') || user.id
    
    if (type === 'followers') {
      // Get users who follow this user
      const followers = await db.follow.findMany({
        where: { followingId: userId },
        select: {
          id: true,
          follower: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              personas: {
                where: { isActive: true },
                select: {
                  id: true,
                  name: true,
                  avatarUrl: true,
                  isOnline: true
                },
                take: 1
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
      
      return NextResponse.json({
        success: true,
        followers: followers.map(f => ({
          id: f.id,
          user: {
            id: f.follower.id,
            username: f.follower.username,
            avatarUrl: f.follower.avatarUrl,
            activePersona: f.follower.personas[0] || null
          }
        }))
      })
    } else {
      // Get users this user follows
      const following = await db.follow.findMany({
        where: { followerId: userId },
        select: {
          id: true,
          following: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              personas: {
                where: { isActive: true },
                select: {
                  id: true,
                  name: true,
                  avatarUrl: true,
                  isOnline: true
                },
                take: 1
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
      
      return NextResponse.json({
        success: true,
        following: following.map(f => ({
          id: f.id,
          user: {
            id: f.following.id,
            username: f.following.username,
            avatarUrl: f.following.avatarUrl,
            activePersona: f.following.personas[0] || null
          }
        }))
      })
    }
  } catch (error) {
    console.error('Follow GET error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}

// POST - Follow a user
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionFromRequest(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    const { targetUserId } = body
    
    if (!targetUserId) {
      return NextResponse.json(
        { error: 'Target user ID is required' },
        { status: 400 }
      )
    }
    
    // Can't follow yourself
    if (targetUserId === user.id) {
      return NextResponse.json(
        { error: "You can't follow yourself" },
        { status: 400 }
      )
    }
    
    // Check if target user exists
    const targetUser = await db.user.findUnique({
      where: { id: targetUserId }
    })
    
    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    // Check if already following
    const existingFollow = await db.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: user.id,
          followingId: targetUserId
        }
      }
    })
    
    if (existingFollow) {
      return NextResponse.json(
        { error: 'Already following this user' },
        { status: 400 }
      )
    }
    
    // Create follow relationship
    const follow = await db.follow.create({
      data: {
        followerId: user.id,
        followingId: targetUserId
      }
    })
    
    return NextResponse.json({
      success: true,
      follow: {
        id: follow.id,
        followedAt: follow.createdAt
      }
    })
  } catch (error) {
    console.error('Follow POST error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}

// DELETE - Unfollow a user
export async function DELETE(request: NextRequest) {
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
    
    // Delete follow relationship
    const deleted = await db.follow.deleteMany({
      where: {
        followerId: user.id,
        followingId: targetUserId
      }
    })
    
    if (deleted.count === 0) {
      return NextResponse.json(
        { error: 'Not following this user' },
        { status: 400 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Unfollowed successfully'
    })
  } catch (error) {
    console.error('Follow DELETE error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
