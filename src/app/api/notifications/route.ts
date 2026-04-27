import { NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'

// Dynamic import to force fresh PrismaClient with Notification model
async function getPrisma() {
  const { PrismaClient } = await import('@prisma/client')
  return new PrismaClient()
}

export async function GET(request: Request) {
  try {
    const user = await getSessionFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const prisma = await getPrisma()
    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
        isDismissed: false
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20
    })

    return NextResponse.json({
      notifications,
      count: notifications.length
    })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
