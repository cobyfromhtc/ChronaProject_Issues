import { db } from '@/lib/db'
import crypto from 'crypto'

// Blorp constants
export const BLORP_USER_ID = 'blorp-official'
export const BLORP_USERNAME = 'Blorp'
export const BLORP_AVATAR = 'https://api.dicebear.com/7.x/bots/svg?seed=blorp-chrona&backgroundColor=8b5cf6'

// Blorp persona ID for DMs
let blorpPersonaId: string | null = null

/**
 * Ensures the Blorp official bot account exists
 * Should be called on app startup
 */
export async function ensureBlorpExists(): Promise<void> {
  try {
    // Check by ID first, then by username (supports both auto-created and manual Blorp users)
    let existingBlorp = await db.user.findUnique({
      where: { id: BLORP_USER_ID }
    })
    if (!existingBlorp) {
      existingBlorp = await db.user.findFirst({
        where: { username: BLORP_USERNAME }
      })
    }

    if (existingBlorp) {
      // Ensure Blorp has a persona for DMs
      const blorpPersona = await db.persona.findFirst({
        where: { userId: existingBlorp.id }
      })

      if (!blorpPersona) {
        const newPersona = await db.persona.create({
          data: {
            id: `blorp-persona-${crypto.randomBytes(8).toString('hex')}`,
            userId: existingBlorp.id,
            name: 'Blorp',
            avatarUrl: BLORP_AVATAR,
            description: 'Official Chrona Bot - Your friendly notification assistant!',
            isActive: true,
            isOnline: true,
          }
        })
        blorpPersonaId = newPersona.id
      } else {
        blorpPersonaId = blorpPersona.id
      }
      return
    }

    // Create Blorp user
    await db.user.create({
      data: {
        id: BLORP_USER_ID,
        username: BLORP_USERNAME,
        password: crypto.randomBytes(64).toString('hex'), // Unusable password
        securityKey: crypto.randomBytes(32).toString('hex'),
        avatarUrl: BLORP_AVATAR,
        role: 'owner',
        isOfficial: true,
        chronos: 999999999, // Unlimited Chronos
      }
    })

    // Create Blorp persona for DMs
    const blorpPersona = await db.persona.create({
      data: {
        id: `blorp-persona-${crypto.randomBytes(8).toString('hex')}`,
        userId: BLORP_USER_ID,
        name: 'Blorp',
        avatarUrl: BLORP_AVATAR,
        description: 'Official Chrona Bot - Your friendly notification assistant!',
        isActive: true,
        isOnline: true,
      }
    })

    blorpPersonaId = blorpPersona.id
    console.log('[Blorp] Official bot account created')
  } catch (error) {
    console.error('[Blorp] Error ensuring Blorp exists:', error)
  }
}

/**
 * Gets Blorp's persona ID (creates persona if needed)
 */
export async function getBlorpPersonaId(): Promise<string | null> {
  if (blorpPersonaId) return blorpPersonaId

  try {
    // Check by ID first, then by username
    let blorpUser = await db.user.findUnique({ where: { id: BLORP_USER_ID } })
    if (!blorpUser) {
      blorpUser = await db.user.findFirst({ where: { username: BLORP_USERNAME } })
    }
    if (!blorpUser) return null

    const blorpPersona = await db.persona.findFirst({
      where: { userId: blorpUser.id }
    })

    if (blorpPersona) {
      blorpPersonaId = blorpPersona.id
      return blorpPersonaId
    }

    // Create persona if missing
    const newPersona = await db.persona.create({
      data: {
        id: `blorp-persona-${crypto.randomBytes(8).toString('hex')}`,
        userId: blorpUser.id,
        name: 'Blorp',
        avatarUrl: BLORP_AVATAR,
        description: 'Official Chrona Bot - Your friendly notification assistant!',
        isActive: true,
        isOnline: true,
      }
    })

    blorpPersonaId = newPersona.id
    return blorpPersonaId
  } catch (error) {
    console.error('[Blorp] Error getting Blorp persona:', error)
    return null
  }
}

/**
 * Gets a user's active persona ID
 */
async function getUserPersonaId(userId: string): Promise<string | null> {
  const persona = await db.persona.findFirst({
    where: {
      userId,
      isActive: true
    }
  })

  if (persona) return persona.id

  // Get any persona if no active one
  const anyPersona = await db.persona.findFirst({
    where: { userId }
  })

  return anyPersona?.id || null
}

/**
 * Gets or creates a conversation between Blorp and a user's persona
 */
async function getOrCreateBlorpConversation(userPersonaId: string): Promise<string | null> {
  const borpId = await getBlorpPersonaId()
  if (!borpId) return null

  // Check for existing conversation (Blorp is always personaA for consistency)
  const existing = await db.conversation.findFirst({
    where: {
      OR: [
        { personaAId: borpId, personaBId: userPersonaId },
        { personaAId: userPersonaId, personaBId: borpId }
      ]
    }
  })

  if (existing) return existing.id

  // Create new conversation
  const conversation = await db.conversation.create({
    data: {
      personaAId: borpId,
      personaBId: userPersonaId,
    }
  })

  return conversation.id
}

/**
 * Message types for Blorp notifications
 */
export type BlorpMessageType =
  | 'welcome'
  | 'gift_sent'
  | 'gift_received'
  | 'chronos_deducted'
  | 'chronos_granted'
  | 'marketplace_sale'
  | 'marketplace_purchase'

interface BlorpMessageData {
  type: BlorpMessageType
  amount?: number
  recipientUsername?: string
  senderUsername?: string
  reason?: string
  adminName?: string
  personaName?: string
  price?: number
  earnings?: number
}

/**
 * Generates Blorp message content based on type
 */
function generateBlorpMessage(data: BlorpMessageData): { title: string; content: string } {
  switch (data.type) {
    case 'welcome':
      return {
        title: 'Welcome to Chrona!',
        content: `Hello, and welcome to Chrona! 🎉

I'm Blorp, your official Chrona assistant! I'm here to keep you updated on important account activity.

Here's what you can do on Chrona:
• Create unique character personas and roleplay with others
• Join storylines and build stories together
• Earn and spend Chronos on cool customization options
• Buy and sell personas on the marketplace

If you have any questions, feel free to explore or ask the community!

Happy roleplaying! ✨`
      }

    case 'gift_sent':
      return {
        title: 'Gift Sent! 🎁',
        content: `You sent a gift of **${data.amount?.toLocaleString()} Chronos** to @${data.recipientUsername}!

${data.reason ? `Your message: "${data.reason}"` : 'No message was included with this gift.'}

The recipient has been notified and received the Chronos directly.`
      }

    case 'gift_received':
      return {
        title: 'You Received a Gift! 🎁',
        content: `Great news! @${data.senderUsername} sent you a gift of **${data.amount?.toLocaleString()} Chronos**!

${data.reason ? `They said: "${data.reason}"` : ''}

Your new balance has been updated. Enjoy!`
      }

    case 'chronos_deducted':
      return {
        title: 'Chronos Deducted',
        content: `**${data.amount?.toLocaleString()} Chronos** have been deducted from your account.

${data.reason ? `Reason: ${data.reason}` : ''}

If you believe this was an error, please contact support.`
      }

    case 'chronos_granted':
      return {
        title: 'Chronos Granted! 💰',
        content: `You've been granted **${data.amount?.toLocaleString()} Chronos**!

${data.adminName ? `Granted by: ${data.adminName}` : ''}

${data.reason ? `Reason: ${data.reason}` : ''}

Your balance has been updated. Enjoy!`
      }

    case 'marketplace_sale':
      // Handle both paid and free downloads
      if (data.earnings && data.earnings > 0) {
        return {
          title: 'Your Persona Sold! 💎',
          content: `Congratulations! Your persona **"${data.personaName}"** has been purchased from the marketplace!

**Sale Details:**
• Price: ${data.price?.toLocaleString()} Chronos
• Your Earnings: ${data.earnings?.toLocaleString()} Chronos (after fees)

The Chronos have been added to your balance. Keep creating amazing characters! ✨`
        }
      } else {
        return {
          title: 'Your Persona Was Downloaded! 🎉',
          content: `Great news! Your persona **"${data.personaName}"** has been downloaded from the marketplace!

Someone appreciated your character enough to add it to their collection. Keep creating amazing characters! ✨`
        }
      }

    case 'marketplace_purchase':
      return {
        title: 'Purchase Confirmed! 🛒',
        content: `Your marketplace purchase is complete!

**Details:**
• Persona: ${data.personaName}
• Price: ${data.price?.toLocaleString()} Chronos

You can now find this persona in your collection. Enjoy your new character!`
      }

    default:
      return {
        title: 'Notification',
        content: 'You have a new notification from Chrona.'
      }
  }
}

/**
 * Sends a message from Blorp to a user
 */
export async function sendBlorpMessage(
  userId: string,
  messageData: BlorpMessageData
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get user's persona
    const userPersonaId = await getUserPersonaId(userId)
    if (!userPersonaId) {
      return { success: false, error: 'User has no persona' }
    }

    // Get Blorp's persona
    const borpId = await getBlorpPersonaId()
    if (!borpId) {
      return { success: false, error: 'Blorp persona not found' }
    }

    // Get or create conversation
    const conversationId = await getOrCreateBlorpConversation(userPersonaId)
    if (!conversationId) {
      return { success: false, error: 'Could not create conversation' }
    }

    // Generate message content
    const { content } = generateBlorpMessage(messageData)

    // Send the message
    await db.message.create({
      data: {
        conversationId,
        senderId: borpId,
        content,
      }
    })

    // Update conversation last message time
    await db.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() }
    })

    return { success: true }
  } catch (error) {
    console.error('[Blorp] Error sending message:', error)
    return { success: false, error: 'Failed to send message' }
  }
}

/**
 * Sends a custom message from Blorp to a user (for admin commands)
 */
export async function sendCustomBlorpMessage(
  userId: string,
  customContent: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get user's persona
    const userPersonaId = await getUserPersonaId(userId)
    if (!userPersonaId) {
      return { success: false, error: 'User has no persona' }
    }

    // Get Blorp's persona
    const borpId = await getBlorpPersonaId()
    if (!borpId) {
      return { success: false, error: 'Blorp persona not found' }
    }

    // Get or create conversation
    const conversationId = await getOrCreateBlorpConversation(userPersonaId)
    if (!conversationId) {
      return { success: false, error: 'Could not create conversation' }
    }

    // Send the custom message
    await db.message.create({
      data: {
        conversationId,
        senderId: borpId,
        content: customContent,
      }
    })

    // Update conversation last message time
    await db.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() }
    })

    return { success: true }
  } catch (error) {
    console.error('[Blorp] Error sending custom message:', error)
    return { success: false, error: 'Failed to send message' }
  }
}

/**
 * Sends a message from Blorp to all users (for announcements)
 */
export async function sendBlorpMessageToAll(
  content: string
): Promise<{ success: boolean; sentCount: number; failedCount: number; errors: string[] }> {
  const results = {
    success: true,
    sentCount: 0,
    failedCount: 0,
    errors: [] as string[]
  }

  try {
    // Get all users (excluding Blorp itself)
    const users = await db.user.findMany({
      where: {
        id: { not: BLORP_USER_ID },
        isBanned: false,
        isFrozen: false,
      },
      select: { id: true }
    })

    // Send to each user
    for (const user of users) {
      const result = await sendCustomBlorpMessage(user.id, content)
      if (result.success) {
        results.sentCount++
      } else {
        results.failedCount++
        results.errors.push(`User ${user.id}: ${result.error}`)
      }
    }

    return results
  } catch (error) {
    console.error('[Blorp] Error sending message to all:', error)
    results.success = false
    results.errors.push('Failed to fetch users')
    return results
  }
}

/**
 * Helper function to send custom Blorp message (used by modCommands)
 */
export async function sendCustomBlorpMessageWrapper(
  userId: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  return sendCustomBlorpMessage(userId, content)
}

/**
 * Helper function to send Blorp message to all users (used by modCommands)
 */
export async function sendBlorpMessageToAllWrapper(
  content: string
): Promise<{ success: boolean; sentCount: number; failedCount: number; errors: string[] }> {
  return sendBlorpMessageToAll(content)
}
