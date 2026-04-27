import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// POST - Ignore a DM request
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
    
    const { id: requestId } = await params
    
    // Get the DM request
    const dmRequest = await db.dmRequest.findUnique({
      where: { id: requestId },
      include: {
        receiver: {
          select: { userId: true }
        }
      }
    })
    
    if (!dmRequest) {
      return NextResponse.json(
        { error: 'DM request not found' },
        { status: 404 }
      )
    }
    
    // Verify the receiver belongs to the current user
    if (dmRequest.receiver.userId !== user.id) {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 403 }
      )
    }
    
    // Update DM request status to ignored
    await db.dmRequest.update({
      where: { id: requestId },
      data: { status: 'ignored' }
    })
    
    return NextResponse.json({
      success: true,
      message: 'DM request ignored'
    })
    
  } catch (error) {
    console.error('Ignore DM request error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
