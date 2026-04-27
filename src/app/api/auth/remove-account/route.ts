import { NextRequest, NextResponse } from 'next/server'
import { removeAccountFromStore, getSession } from '@/lib/auth'
import { z } from 'zod'

const removeSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
})

export async function POST(request: NextRequest) {
  try {
    // Check if currently authenticated
    const currentUser = await getSession()
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    
    // Validate input
    const result = removeSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }
    
    const { userId } = result.data
    
    // Remove the account
    const { success, switchedTo } = await removeAccountFromStore(userId)
    
    if (!success) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      switchedTo: switchedTo ? {
        id: switchedTo.id,
        email: switchedTo.email,
        username: switchedTo.username,
        avatarUrl: switchedTo.avatarUrl,
      } : null,
      loggedOut: !switchedTo // If no account to switch to, user is logged out
    })
    
  } catch (error) {
    console.error('[API] Remove account error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
