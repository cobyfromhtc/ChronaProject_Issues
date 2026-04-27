import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const connectionSchema = z.object({
  characterName: z.string().min(1, 'Character name is required').max(100),
  relationshipType: z.string().min(1, 'Relationship type is required').max(50),
  specificRole: z.string().max(100).optional().nullable(),
  characterAge: z.number().int().min(0).max(9999).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
})

// GET - Fetch all connections for a persona
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    const { id: personaId } = await params
    
    // Verify persona belongs to user
    const persona = await db.persona.findFirst({
      where: { id: personaId, userId: user.id }
    })
    
    if (!persona) {
      return NextResponse.json(
        { error: 'Persona not found' },
        { status: 404 }
      )
    }
    
    const connections = await db.personaConnection.findMany({
      where: { personaId },
      orderBy: { createdAt: 'asc' }
    })
    
    return NextResponse.json({ 
      success: true,
      connections 
    })
    
  } catch (error) {
    console.error('Fetch connections error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}

// POST - Add a new connection
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    const { id: personaId } = await params
    const body = await request.json()
    
    // Validate input
    const result = connectionSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }
    
    // Verify persona belongs to user
    const persona = await db.persona.findFirst({
      where: { id: personaId, userId: user.id }
    })
    
    if (!persona) {
      return NextResponse.json(
        { error: 'Persona not found' },
        { status: 404 }
      )
    }
    
    const data = result.data
    
    const connection = await db.personaConnection.create({
      data: {
        personaId,
        characterName: data.characterName,
        relationshipType: data.relationshipType,
        specificRole: data.specificRole || null,
        characterAge: data.characterAge ?? null,
        description: data.description || null,
      }
    })
    
    return NextResponse.json({ 
      success: true,
      connection 
    })
    
  } catch (error) {
    console.error('Create connection error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}