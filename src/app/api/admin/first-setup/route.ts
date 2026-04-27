import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, generateSecurityKey, hashSecurityKey } from '@/lib/auth'
import { env } from '@/lib/env'

/**
 * First-Time Setup API
 * 
 * Creates the initial owner account. This endpoint is only available when:
 * 1. No owner accounts exist yet
 * 2. The correct FIRST_SETUP_KEY is provided
 * 
 * Security:
 * - Set FIRST_SETUP_KEY in your environment before deployment
 * - After creating the owner, this endpoint becomes disabled
 */

// POST - Create initial owner account
export async function POST(request: NextRequest) {
  try {
    // Check if setup is allowed
    const setupKey = env.firstSetupKey
    
    if (!setupKey) {
      return NextResponse.json(
        { error: 'First-time setup is disabled. Set FIRST_SETUP_KEY environment variable to enable.' },
        { status: 403 }
      )
    }
    
    // Verify the setup key from request
    const body = await request.json()
    const { setupKey: providedKey, username, password, email } = body
    
    if (providedKey !== setupKey) {
      return NextResponse.json(
        { error: 'Invalid setup key' },
        { status: 401 }
      )
    }
    
    // Check if any owner already exists
    const existingOwner = await db.user.findFirst({
      where: { role: 'owner' }
    })
    
    if (existingOwner) {
      return NextResponse.json(
        { error: 'Owner account already exists. Setup is no longer available.' },
        { status: 403 }
      )
    }
    
    // Validate input
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      )
    }
    
    if (username.length < 3 || username.length > 20) {
      return NextResponse.json(
        { error: 'Username must be between 3 and 20 characters' },
        { status: 400 }
      )
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json(
        { error: 'Username can only contain letters, numbers, and underscores' },
        { status: 400 }
      )
    }
    
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }
    
    // Check if username already exists
    const existingUser = await db.user.findUnique({
      where: { username }
    })
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 400 }
      )
    }
    
    // Create owner account
    const hashedPassword = await hashPassword(password)
    const securityKey = generateSecurityKey()
    const hashedSecurityKey = hashSecurityKey(securityKey)
    
    const user = await db.user.create({
      data: {
        username,
        password: hashedPassword,
        securityKey: hashedSecurityKey,
        email: email || null,
        role: 'owner', // This is the owner account
        chronos: 10000, // Give owner a large starting balance
      }
    })
    
    // Record the initial Chronos as a transaction
    await db.chronosTransaction.create({
      data: {
        userId: user.id,
        amount: 10000,
        balance: 10000,
        type: 'admin',
        category: 'owner_setup',
        description: 'Initial Chronos balance for owner account',
      }
    })
    
    // Log admin action
    await db.adminLog.create({
      data: {
        adminId: user.id,
        action: 'first_setup',
        targetType: 'user',
        targetId: user.id,
        details: JSON.stringify({ username, role: 'owner' }),
      }
    })
    
    return NextResponse.json({
      success: true,
      message: 'Owner account created successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      securityKey, // IMPORTANT: Show this to the user to save!
      warning: 'SAVE YOUR SECURITY KEY! You will need it to log in. It will not be shown again.',
    })
    
  } catch (error) {
    console.error('[First Setup] Error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}

// GET - Check if setup is available
export async function GET() {
  try {
    // Check if any owner exists
    const existingOwner = await db.user.findFirst({
      where: { role: 'owner' },
      select: { id: true }
    })
    
    const setupKeyConfigured = !!env.firstSetupKey
    
    return NextResponse.json({
      setupAvailable: !existingOwner && setupKeyConfigured,
      ownerExists: !!existingOwner,
      setupKeyConfigured,
    })
    
  } catch (error) {
    console.error('[First Setup] Error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
