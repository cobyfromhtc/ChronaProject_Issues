import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// POST - Activate a persona (and deactivate others)
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
    
    const { id } = await params
    
    // Check if persona belongs to user
    const persona = await db.persona.findFirst({
      where: { 
        id,
        userId: user.id 
      },
    })
    
    if (!persona) {
      return NextResponse.json(
        { error: 'Persona not found' },
        { status: 404 }
      )
    }
    
    // Deactivate all other personas
    await db.persona.updateMany({
      where: { 
        userId: user.id,
        id: { not: id }
      },
      data: { 
        isActive: false,
        isOnline: false 
      },
    })
    
    // Activate this persona
    const updatedPersona = await db.persona.update({
      where: { id },
      data: { 
        isActive: true,
        isOnline: true 
      },
    })
    
    return NextResponse.json({ 
      success: true,
      persona: updatedPersona 
    })
    
  } catch (error) {
    console.error('Activate persona error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
