import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// POST - Create a new category
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const { id } = await params
    const body = await request.json()
    const { name } = body
    
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    
    // Check permissions
    const membership = await db.storylineMember.findFirst({
      where: { storylineId: id, userId: user.id },
      include: {
        customRole: {
          select: {
            canManageChannels: true,
          }
        }
      }
    })
    
    if (!membership) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 })
    }
    
    const canManageChannels = membership.role === 'owner' || 
      membership.role === 'admin' || 
      membership.customRole?.canManageChannels
    
    if (!canManageChannels) {
      return NextResponse.json({ error: 'Not authorized to manage channels' }, { status: 403 })
    }
    
    // Get max position
    const maxPosition = await db.storylineCategory.findFirst({
      where: { storylineId: id },
      orderBy: { position: 'desc' },
      select: { position: true }
    })
    
    const category = await db.storylineCategory.create({
      data: {
        storylineId: id,
        name: name.trim(),
        position: (maxPosition?.position ?? -1) + 1
      }
    })
    
    return NextResponse.json({ success: true, category })
    
  } catch (error) {
    console.error('Create category error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
