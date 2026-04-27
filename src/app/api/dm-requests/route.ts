import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { canInteract } from '@/lib/age-utils'

// GET - Fetch all pending DM requests for the current user
export async function GET() {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    // Age-gating: Fetch user's DOB for age checks
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { dateOfBirth: true }
    })
    const userDob = dbUser?.dateOfBirth ?? null
    
    // Get all personas for this user to check for received DM requests
    const userPersonas = await db.persona.findMany({
      where: { userId: user.id },
      select: { id: true }
    })
    
    const personaIds = userPersonas.map(p => p.id)
    
    // Fetch all pending DM requests for user's personas
    const dmRequests = await db.dmRequest.findMany({
      where: {
        receiverId: { in: personaIds },
        status: 'pending'
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            user: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
                dateOfBirth: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    // Age-gating: Filter DM requests to only show those from users in the same age bracket
    const filteredDmRequests = dmRequests.filter(req => {
      const senderDob = req.sender.user.dateOfBirth ?? null
      return canInteract(userDob, senderDob)
    })
    
    return NextResponse.json({
      success: true,
      dmRequests: filteredDmRequests.map(req => ({
        id: req.id,
        firstMessage: req.firstMessage,
        imageUrl: req.imageUrl,
        createdAt: req.createdAt,
        sender: {
          id: req.sender.id,
          name: req.sender.name,
          avatarUrl: req.sender.avatarUrl,
          username: req.sender.user.username,
          userId: req.sender.user.id
        }
      }))
    })
    
  } catch (error) {
    console.error('Fetch DM requests error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
