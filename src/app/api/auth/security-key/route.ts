import { NextRequest, NextResponse } from 'next/server'
import { getSession, generateSecurityKey, hashSecurityKey } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    // Generate a new security key
    const newSecurityKey = generateSecurityKey()
    const hashedSecurityKey = hashSecurityKey(newSecurityKey)
    
    // Update the user's security key in the database
    await db.user.update({
      where: { id: user.id },
      data: { securityKey: hashedSecurityKey }
    })
    
    return NextResponse.json({
      success: true,
      securityKey: newSecurityKey,
      message: 'New security key generated. Save this key - it will not be shown again.'
    })
    
  } catch (error) {
    console.error('Security key generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate security key' },
      { status: 500 }
    )
  }
}
