import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// POST - Toggle favourite status for a friend
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const { friendId, isFavourite } = await request.json()
    
    if (!friendId) {
      return NextResponse.json({ error: 'Friend ID is required' }, { status: 400 })
    }
    
    // Update the friendship
    const friendship = await db.friendship.findFirst({
      where: { userId: user.id, friendId: friendId }
    })
    
    if (!friendship) {
      return NextResponse.json({ error: 'Friendship not found' }, { status: 404 })
    }
    
    await db.friendship.update({
      where: { id: friendship.id },
      data: { isFavourite: isFavourite ?? true }
    })
    
    return NextResponse.json({ 
      success: true, 
      message: isFavourite ? 'Added to favourites' : 'Removed from favourites' 
    })
    
  } catch (error) {
    console.error('Toggle favourite error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
