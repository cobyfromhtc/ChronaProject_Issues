import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET - Search for users by username (searches ALL users, not just friends)
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    
    if (!query || query.length < 2) {
      return NextResponse.json({ success: true, users: [] })
    }
    
    // SQLite doesn't support mode: 'insensitive', so we fetch matching users
    // and filter case-insensitively in JavaScript
    const queryLower = query.toLowerCase()
    
    // Search users by username - use contains for initial DB filtering
    // then refine with case-insensitive JS matching
    const allUsers = await db.user.findMany({
      where: {
        id: { not: user.id }, // Exclude current user
      },
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
            isOnline: true,
          },
        },
      },
    })

    // Filter by username (case-insensitive) in JavaScript
    const filteredUsers = allUsers.filter(u => 
      u.username.toLowerCase().includes(queryLower)
    ).slice(0, 10)

    // Get current user's friends and pending requests for context
    const [friendships, sentRequests, receivedRequests] = await Promise.all([
      db.friendship.findMany({
        where: { userId: user.id },
        select: { friendId: true },
      }),
      db.friendRequest.findMany({
        where: { senderId: user.id, status: 'pending' },
        select: { receiverId: true },
      }),
      db.friendRequest.findMany({
        where: { receiverId: user.id, status: 'pending' },
        select: { senderId: true },
      }),
    ])

    const friendIds = new Set(friendships.map(f => f.friendId))
    const sentToIds = new Set(sentRequests.map(r => r.receiverId))
    const receivedFromIds = new Set(receivedRequests.map(r => r.senderId))

    const formattedUsers = filteredUsers.map(u => ({
      id: u.id,
      username: u.username,
      avatarUrl: u.avatarUrl,
      activePersona: u.personas[0] || null,
      isFriend: friendIds.has(u.id),
      hasSentRequest: sentToIds.has(u.id),
      hasReceivedRequest: receivedFromIds.has(u.id),
    }))

    return NextResponse.json({ success: true, users: formattedUsers })
    
  } catch (error) {
    console.error('Search users error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
