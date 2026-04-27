import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

// Dynamic import to force fresh PrismaClient with Notification model
async function getPrisma() {
  const { PrismaClient } = await import('@prisma/client')
  return new PrismaClient()
}

// POST - Dismiss a notification
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { notificationId, dismissAll } = body

    const prisma = await getPrisma()

    if (dismissAll) {
      // Dismiss all notifications for this user
      await prisma.notification.updateMany({
        where: {
          userId: user.id,
          isDismissed: false
        },
        data: {
          isDismissed: true,
          isRead: true
        }
      })

      return NextResponse.json({ success: true, dismissedAll: true })
    }

    if (!notificationId) {
      return NextResponse.json({ error: 'Notification ID required' }, { status: 400 })
    }

    // Dismiss specific notification
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId }
    })

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    if (notification.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        isDismissed: true,
        isRead: true
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error dismissing notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
