import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { canInteract } from '@/lib/age-utils'

// GET - Get user's friends list
export async function GET() {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    // Age-gating: Fetch user's DOB for age checks
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { dateOfBirth: true }
    })
    const userDob = dbUser?.dateOfBirth ?? null
    
    // Get all friendships where user is involved
    const friendships = await db.friendship.findMany({
      where: { userId: user.id },
      include: {
        friend: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            dateOfBirth: true,
            personas: {
              where: { isActive: true },
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                isOnline: true
              }
            }
          }
        }
      },
      orderBy: [
        { isFavourite: 'desc' },
        { createdAt: 'desc' }
      ]
    })
    
    // Age-gating: Filter friends list to only show friends in the same age bracket
    const filteredFriendships = friendships.filter(f => {
      const friendDob = f.friend.dateOfBirth ?? null
      return canInteract(userDob, friendDob)
    })
    
    const friends = filteredFriendships.map(f => ({
      id: f.id,
      friendId: f.friend.id,
      username: f.friend.username,
      avatarUrl: f.friend.avatarUrl,
      isFavourite: f.isFavourite,
      activePersona: f.friend.personas[0] || null
    }))
    
    return NextResponse.json({ success: true, friends })
    
  } catch (error) {
    console.error('Get friends error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// POST - Send a friend request
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const { username } = await request.json()
    
    if (!username || !username.trim()) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }
    
    const searchUsername = username.trim().toLowerCase()
    
    // Age-gating: Check that both users are in the same age bracket
    const dbUserForRequest = await db.user.findUnique({
      where: { id: user.id },
      select: { dateOfBirth: true }
    })
    const myDob = dbUserForRequest?.dateOfBirth ?? null
    
    // Find the target user with case-insensitive search
    // SQLite doesn't support case-insensitive findUnique, so we use findFirst with filtering
    const allUsers = await db.user.findMany({
      where: {
        id: { not: user.id }
      },
      select: { id: true, username: true, avatarUrl: true, dateOfBirth: true }
    })
    
    const targetUser = allUsers.find(u => u.username.toLowerCase() === searchUsername)
    
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    if (targetUser.id === user.id) {
      return NextResponse.json({ error: 'Cannot add yourself as a friend' }, { status: 400 })
    }
    
    // Age-gating: Check that both users are in the same age bracket
    const targetDob = targetUser.dateOfBirth ?? null
    if (!canInteract(myDob, targetDob)) {
      return NextResponse.json({ error: 'Cannot send friend request to this user due to age restrictions' }, { status: 403 })
    }
    
    // Check if blocked
    const blocked = await db.block.findFirst({
      where: {
        OR: [
          { blockerId: user.id, blockedId: targetUser.id },
          { blockerId: targetUser.id, blockedId: user.id }
        ]
      }
    })
    
    if (blocked) {
      return NextResponse.json({ error: 'Cannot send friend request to this user' }, { status: 400 })
    }
    
    // Check if already friends
    const existingFriendship = await db.friendship.findFirst({
      where: {
        OR: [
          { userId: user.id, friendId: targetUser.id },
          { userId: targetUser.id, friendId: user.id }
        ]
      }
    })
    
    if (existingFriendship) {
      return NextResponse.json({ error: 'Already friends with this user' }, { status: 400 })
    }
    
    // Check for existing request
    const existingRequest = await db.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: user.id, receiverId: targetUser.id },
          { senderId: targetUser.id, receiverId: user.id }
        ]
      }
    })
    
    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        return NextResponse.json({ error: 'Friend request already pending' }, { status: 400 })
      }
      // Update existing declined request
      await db.friendRequest.update({
        where: { id: existingRequest.id },
        data: { status: 'pending', senderId: user.id, receiverId: targetUser.id }
      })
      return NextResponse.json({ success: true, message: 'Friend request sent!' })
    }
    
    // Create friend request
    await db.friendRequest.create({
      data: {
        senderId: user.id,
        receiverId: targetUser.id,
        status: 'pending'
      }
    })
    
    return NextResponse.json({ success: true, message: 'Friend request sent!' })
    
  } catch (error) {
    console.error('Send friend request error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
