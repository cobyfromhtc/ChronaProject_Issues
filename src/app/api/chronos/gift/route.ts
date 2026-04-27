import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { sendBlorpMessage, ensureBlorpExists } from '@/lib/blorp'

// Constants
const MIN_GIFT_AMOUNT = 10
const MAX_GIFT_AMOUNT = 1000

// POST - Gift Chronos to another user
export async function POST(request: Request) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { recipientUsername, amount, message } = body

    // Validate inputs
    if (!recipientUsername || typeof recipientUsername !== 'string') {
      return NextResponse.json({ error: 'Recipient username is required' }, { status: 400 })
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 })
    }

    if (amount < MIN_GIFT_AMOUNT) {
      return NextResponse.json({ error: `Minimum gift amount is ${MIN_GIFT_AMOUNT} Chronos` }, { status: 400 })
    }

    if (amount > MAX_GIFT_AMOUNT) {
      return NextResponse.json({ error: `Maximum gift amount is ${MAX_GIFT_AMOUNT} Chronos at a time` }, { status: 400 })
    }

    // Validate message length if provided
    const giftMessage = message?.trim() || null
    if (giftMessage && giftMessage.length > 200) {
      return NextResponse.json({ error: 'Message must be 200 characters or less' }, { status: 400 })
    }

    // Get sender's current data
    const sender = await db.user.findUnique({
      where: { id: user.id },
      select: {
        chronos: true,
        username: true,
      }
    })

    if (!sender) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if sender has enough Chronos
    if (sender.chronos < amount) {
      return NextResponse.json({ 
        error: 'Insufficient Chronos',
        required: amount,
        current: sender.chronos 
      }, { status: 400 })
    }

    // Find recipient by username (case-insensitive)
    const recipient = await db.user.findFirst({
      where: {
        username: {
          equals: recipientUsername,
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        username: true,
        chronos: true,
      }
    })

    if (!recipient) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent self-gifting
    if (recipient.id === user.id) {
      return NextResponse.json({ error: 'You cannot gift Chronos to yourself' }, { status: 400 })
    }

    // Perform the gift transaction using a transaction
    const result = await db.$transaction(async (tx) => {
      // Deduct from sender
      const senderNewBalance = sender.chronos - amount
      await tx.user.update({
        where: { id: user.id },
        data: { chronos: senderNewBalance }
      })

      // Add to recipient
      const recipientNewBalance = recipient.chronos + amount
      await tx.user.update({
        where: { id: recipient.id },
        data: { chronos: recipientNewBalance }
      })

      // Record sender's transaction
      await tx.chronosTransaction.create({
        data: {
          userId: user.id,
          amount: -amount,
          balance: senderNewBalance,
          type: 'spend',
          category: 'gift_sent',
          description: `Gifted ${amount} Chronos to @${recipient.username}${giftMessage ? `: "${giftMessage}"` : ''}`,
          referenceId: recipient.id,
        }
      })

      // Record recipient's transaction
      await tx.chronosTransaction.create({
        data: {
          userId: recipient.id,
          amount: amount,
          balance: recipientNewBalance,
          type: 'earn',
          category: 'gift_received',
          description: `Received ${amount} Chronos from @${sender.username}${giftMessage ? `: "${giftMessage}"` : ''}`,
          referenceId: user.id,
        }
      })

      // Create notification for recipient
      await tx.notification.create({
        data: {
          userId: recipient.id,
          type: 'gift_received',
          title: 'You received a Chronos gift!',
          message: `@${sender.username} sent you ${amount} Chronos${giftMessage ? ` with a message: "${giftMessage}"` : ''}!`,
          data: JSON.stringify({
            senderId: user.id,
            senderUsername: sender.username,
            amount,
            message: giftMessage,
          }),
        }
      })

      return {
        senderNewBalance,
        recipientUsername: recipient.username,
      }
    })

    // Ensure Blorp exists and send messages
    await ensureBlorpExists()

    // Send Blorp message to sender
    await sendBlorpMessage(user.id, {
      type: 'gift_sent',
      amount,
      recipientUsername: recipient.username,
      reason: giftMessage || undefined,
    })

    // Send Blorp message to recipient
    await sendBlorpMessage(recipient.id, {
      type: 'gift_received',
      amount,
      senderUsername: sender.username,
      reason: giftMessage || undefined,
    })

    return NextResponse.json({
      success: true,
      chronos: result.senderNewBalance,
      recipientUsername: result.recipientUsername,
      amount,
      message: `Successfully gifted ${amount} Chronos to @${result.recipientUsername}!`
    })
  } catch (error) {
    console.error('Error gifting Chronos:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
