import { NextResponse } from 'next/server'
import { clearSessionCookie, getSession } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST() {
  try {
    const user = await getSession()
    
    // Set all user's personas to offline before logging out
    if (user) {
      await db.persona.updateMany({
        where: { userId: user.id },
        data: { isOnline: false }
      })
    }
    
    await clearSessionCookie()
    
    return NextResponse.json({ 
      success: true,
      message: 'Logged out successfully' 
    })
    
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
