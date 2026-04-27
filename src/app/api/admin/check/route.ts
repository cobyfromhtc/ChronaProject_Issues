import { NextResponse } from 'next/server'
import { getSessionWithFreshRole } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getSessionWithFreshRole()
    
    if (!user) {
      return NextResponse.json({ isAdmin: false, role: null })
    }

    const isStaff = ['mod', 'admin', 'owner'].includes(user.role)
    
    return NextResponse.json({
      isAdmin: isStaff,
      role: user.role,
      user: {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl
      }
    })
  } catch (error) {
    console.error('Error checking admin status:', error)
    return NextResponse.json({ isAdmin: false, role: null }, { status: 500 })
  }
}
