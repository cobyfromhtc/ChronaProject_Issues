import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// Change username endpoint

export async function POST(request: Request) {
  try {
    const sessionUser = await getSession()

    if (!sessionUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { newUsername } = await request.json()

    if (!newUsername || typeof newUsername !== 'string') {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      )
    }

    // Validate username
    const trimmedUsername = newUsername.trim()
    
    if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
      return NextResponse.json(
        { error: 'Username must be 3-20 characters' },
        { status: 400 }
      )
    }

    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      return NextResponse.json(
        { error: 'Username can only contain letters, numbers, and underscores' },
        { status: 400 }
      )
    }

    // Check if username is already taken by another user
    const existingUser = await db.user.findUnique({
      where: { username: trimmedUsername }
    })

    if (existingUser && existingUser.id !== sessionUser.id) {
      return NextResponse.json(
        { error: 'Username is already taken' },
        { status: 400 }
      )
    }

    // Update the user's username
    const updatedUser = await db.user.update({
      where: { id: sessionUser.id },
      data: { username: trimmedUsername },
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
        role: true,
        chronos: true,
      }
    })

    return NextResponse.json({
      success: true,
      user: updatedUser
    })

  } catch (error) {
    console.error('Change username error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
