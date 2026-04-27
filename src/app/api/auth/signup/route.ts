import { NextRequest, NextResponse } from 'next/server'
import { createUserWithUsername, createSession, addAccountToStore, usernameExists, emailExists } from '@/lib/auth'
import { authRateLimiter } from '@/lib/rate-limit'
import { sendBlorpMessage, ensureBlorpExists } from '@/lib/blorp'
import { z } from 'zod'

const signupSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password is too long'),
  confirmPassword: z.string(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting for auth endpoints
    const rateLimitResponse = authRateLimiter(request)
    if (rateLimitResponse) {
      return rateLimitResponse
    }
    
    const body = await request.json()
    
    // Validate input
    const result = signupSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }
    
    const { username, password, email, dateOfBirth } = result.data
    
    // Validate date of birth
    const dob = new Date(dateOfBirth)
    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    if (age < 16) {
      return NextResponse.json(
        { error: 'You must be at least 16 years old to use Chrona' },
        { status: 400 }
      )
    }
    
    // Check if username already exists
    if (await usernameExists(username)) {
      return NextResponse.json(
        { error: 'This username is already taken' },
        { status: 400 }
      )
    }
    
    // Check if email already exists (if provided)
    if (email && await emailExists(email)) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      )
    }
    
    // Create user with security key
    const { user, securityKey } = await createUserWithUsername(username, password, email || undefined, dob)
    
    // Create session token (but NOT logged in yet - need to verify security key first)
    const token = await createSession({
      ...user,
      securityVerified: false,
    })
    
    // Add to accounts store
    await addAccountToStore({
      ...user,
      securityVerified: false,
    }, token)

    // Send welcome message from Blorp (async, don't block response)
    ensureBlorpExists().then(() => {
      sendBlorpMessage(user.id, { type: 'welcome' }).catch(err => {
        console.error('Failed to send Blorp welcome message:', err)
      })
    })

    // Return user with security key (show ONCE)
    return NextResponse.json({ 
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
      },
      securityKey,  // Frontend must show this to user
      requiresSecurityKeyDisplay: true,  // Signal to frontend
    })
    
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}