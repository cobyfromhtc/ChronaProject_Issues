import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Fetch public persona data for AI generation
// This endpoint allows fetching any persona's data for roleplay purposes
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const persona = await db.persona.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        backstory: true,
        personalityDescription: true,
        personalitySpectrums: true,
        bigFive: true,
        hexaco: true,
        strengths: true,
        flaws: true,
        values: true,
        fears: true,
        likes: true,
        dislikes: true,
        hobbies: true,
        speechPatterns: true,
        mbtiType: true,
        gender: true,
        age: true,
        species: true,
        isOnline: true,
      }
    })
    
    if (!persona) {
      return NextResponse.json(
        { error: 'Persona not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ 
      success: true,
      persona 
    })
    
  } catch (error) {
    console.error('Fetch public persona error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
