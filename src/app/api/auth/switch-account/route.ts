import { NextRequest, NextResponse } from 'next/server'
import { switchToAccount, getSessionFromRequest } from '@/lib/auth'
import { z } from 'zod'

const switchSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
})

export async function POST(request: NextRequest) {
  try {
    // Check if currently authenticated (check both Authorization header and cookies)
    const currentUser = await getSessionFromRequest(request)
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    
    // Validate input
    const result = switchSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }
    
    const { userId } = result.data
    
    // Switch to the account
    const switchResult = await switchToAccount(userId)
    
    if (!switchResult) {
      return NextResponse.json(
        { error: 'Account not found or session expired. Please log in again.' },
        { status: 404 }
      )
    }
    
    const { user, token } = switchResult
    
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl,
        role: user.role,
        chronos: user.chronos,
      },
      token,
    })
    
  } catch (error) {
    console.error('[API] Switch account error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
