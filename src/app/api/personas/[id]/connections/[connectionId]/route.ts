import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const updateConnectionSchema = z.object({
  characterName: z.string().min(1, 'Character name is required').max(100).optional(),
  relationshipType: z.string().min(1, 'Relationship type is required').max(50).optional(),
  specificRole: z.string().max(100).optional().nullable(),
  characterAge: z.number().int().min(0).max(9999).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
})

// PUT - Update a connection
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; connectionId: string }> }
) {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    const { id: personaId, connectionId } = await params
    const body = await request.json()
    
    // Validate input
    const result = updateConnectionSchema.safeParse(body)
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
    
    // Verify connection belongs to this persona
    const existingConnection = await db.personaConnection.findFirst({
      where: { id: connectionId, personaId }
    })
    
    if (!existingConnection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      )
    }
    
    const data = result.data
    
    const connection = await db.personaConnection.update({
      where: { id: connectionId },
      data: {
        characterName: data.characterName,
        relationshipType: data.relationshipType,
        specificRole: data.specificRole,
        characterAge: data.characterAge,
        description: data.description,
      }
    })
    
    return NextResponse.json({ 
      success: true,
      connection 
    })
    
  } catch (error) {
    console.error('Update connection error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a connection
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; connectionId: string }> }
) {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    const { id: personaId, connectionId } = await params
    
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
    
    // Verify connection belongs to this persona
    const existingConnection = await db.personaConnection.findFirst({
      where: { id: connectionId, personaId }
    })
    
    if (!existingConnection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      )
    }
    
    await db.personaConnection.delete({
      where: { id: connectionId }
    })
    
    return NextResponse.json({ 
      success: true,
      message: 'Connection deleted' 
    })
    
  } catch (error) {
    console.error('Delete connection error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}