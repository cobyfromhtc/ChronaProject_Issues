import { NextResponse } from 'next/server'
import { getAllAccounts, getSession } from '@/lib/auth'

export async function GET() {
  try {
    // Check if user is authenticated
    const currentUser = await getSession()
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    // Get all accounts
    const { accounts, activeAccountId } = await getAllAccounts()
    
    return NextResponse.json({
      success: true,
      accounts: accounts.map(a => ({
        id: a.user.id,
        email: a.user.email,
        username: a.user.username,
        avatarUrl: a.user.avatarUrl,
        role: a.user.role,
        isActive: a.user.id === activeAccountId
      })),
      activeAccountId
    })
    
  } catch (error) {
    console.error('[API] Get accounts error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
