import { NextRequest, NextResponse } from 'next/server'
import { authenticateUserByUsername, verifyUserSecurityKey, createSession, addAccountToStore } from '@/lib/auth'
import { authRateLimiter } from '@/lib/rate-limit'
import { z } from 'zod'

// Step 1: Login with username/password
const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

// Step 2: Verify security key
const verifySchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  securityKey: z.string().min(1, 'Security key is required'),
})

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting for auth endpoints
    const rateLimitResponse = authRateLimiter(request)
    if (rateLimitResponse) {
      return rateLimitResponse
    }
    
    const body = await request.json()
    
    // Check if this is security key verification step
    if (body.userId && body.securityKey) {
      console.log('[Login] Security key verification for user:', body.userId)
      
      // Step 2: Verify security key
      const result = verifySchema.safeParse(body)
      if (!result.success) {
        return NextResponse.json(
          { error: result.error.issues[0]?.message || 'Invalid input' },
          { status: 400 }
        )
      }
      
      const { userId, securityKey } = result.data
      
      // Verify the security key
      const user = await verifyUserSecurityKey(userId, securityKey)
      
      if (!user) {
        console.log('[Login] Security key verification FAILED for user:', userId)
        return NextResponse.json(
          { error: 'Invalid security key. Please check and try again.' },
          { status: 401 }
        )
      }
      
      console.log('[Login] Security key verified for user:', user.username)
      
      // Create full session
      const token = await createSession(user)
      console.log('[Login] Created session token for user:', user.username)
      
      // Add to accounts store
      await addAccountToStore(user, token)
      
      console.log('[Login] Login complete for user:', user.username, '- returning token')
      
      return NextResponse.json({ 
        success: true,
        token, // Include token for cross-origin/Electron apps
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          avatarUrl: user.avatarUrl,
          role: user.role,
          dateOfBirth: user.dateOfBirth,
          securityVerified: true,
        }
      })
    }
    
    // Step 1: Login with username/password
    const result = loginSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }
    
    const { username, password } = result.data
    console.log('[Login] Username/password login for:', username)
    
    // Authenticate user
    const authResult = await authenticateUserByUsername(username, password)
    
    if (!authResult) {
      console.log('[Login] Username/password FAILED for:', username)
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      )
    }
    
    console.log('[Login] Username/password OK for:', username, '- needs security key')
    
    // Return user info - frontend must now show security key input
    return NextResponse.json({ 
      success: true,
      requiresSecurityKey: true,
      user: {
        id: authResult.user.id,
        username: authResult.user.username,
        email: authResult.user.email,
        avatarUrl: authResult.user.avatarUrl,
        role: authResult.user.role,
        dateOfBirth: authResult.user.dateOfBirth,
      }
    })
    
  } catch (error) {
    console.error('Login error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}