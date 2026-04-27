import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const OFFICIAL_SLUG = 'chrona-community-official'

// GET - Ensure the official community server exists (called on app init)
export async function GET() {
  try {
    // Check if official storyline already exists
    const existing = await db.storyline.findFirst({
      where: { isOfficial: true }
    })

    if (existing) {
      return NextResponse.json({ 
        success: true, 
        message: 'Official community already exists',
        storylineId: existing.id
      })
    }

    // Find or create a system user to own the official server
    let systemUser = await db.user.findFirst({
      where: { role: 'owner' }
    })

    if (!systemUser) {
      // Fallback: find any admin
      systemUser = await db.user.findFirst({
        where: { role: 'admin' }
      })
    }

    if (!systemUser) {
      // Fallback: find any user (shouldn't happen in practice)
      systemUser = await db.user.findFirst()
    }

    if (!systemUser) {
      return NextResponse.json({ 
        error: 'No users exist yet - cannot create official server' 
      }, { status: 400 })
    }

    // Create the official storyline
    const storyline = await db.storyline.create({
      data: {
        ownerId: systemUser.id,
        name: 'Chrona Community',
        description: 'The official Chrona community server! Join to meet other roleplayers, share your characters, and get the latest news.',
        lore: 'The Chrona Community is the central hub for all things Chrona. Whether you\'re a seasoned roleplayer or just starting out, this is your home base.',
        category: 'Other',
        tags: JSON.stringify(['official', 'community', 'chrona', 'announcements', 'help']),
        isPublic: true,
        isOfficial: true,
        isAdult: false,
        accentColor: '#14b8a6',
        welcomeMessage: 'Welcome to the Chrona Community! 🎉 This is the official gathering place for all Chrona users.',
        requireApproval: false,
        memberCap: null,
      }
    })

    // Create default roles
    const ownerRole = await db.storylineRole.create({
      data: {
        storylineId: storyline.id,
        name: 'Owner',
        color: '#fbbf24',
        position: 100,
        canManageChannels: true,
        canManageRoles: true,
        canKickMembers: true,
        canBanMembers: true,
        canManageMessages: true,
        canInvite: true,
        canChangeSettings: true,
        isAdmin: true
      }
    })

    await db.storylineRole.create({
      data: {
        storylineId: storyline.id,
        name: 'Admin',
        color: '#ef4444',
        position: 50,
        canManageChannels: true,
        canManageRoles: false,
        canKickMembers: true,
        canBanMembers: true,
        canManageMessages: true,
        canInvite: true,
        canChangeSettings: false,
        isAdmin: true
      }
    })

    await db.storylineRole.create({
      data: {
        storylineId: storyline.id,
        name: 'Moderator',
        color: '#3b82f6',
        position: 25,
        canManageChannels: false,
        canManageRoles: false,
        canKickMembers: true,
        canBanMembers: false,
        canManageMessages: true,
        canInvite: true,
        canChangeSettings: false,
        isAdmin: false
      }
    })

    await db.storylineRole.create({
      data: {
        storylineId: storyline.id,
        name: 'Member',
        color: '#8b5cf6',
        position: 0,
        canManageChannels: false,
        canManageRoles: false,
        canKickMembers: false,
        canBanMembers: false,
        canManageMessages: false,
        canInvite: true,
        canChangeSettings: false,
        isAdmin: false
      }
    })

    // Create categories
    const infoCategory = await db.storylineCategory.create({
      data: {
        storylineId: storyline.id,
        name: 'INFORMATION',
        position: 0
      }
    })

    const generalCategory = await db.storylineCategory.create({
      data: {
        storylineId: storyline.id,
        name: 'GENERAL',
        position: 1
      }
    })

    const creativeCategory = await db.storylineCategory.create({
      data: {
        storylineId: storyline.id,
        name: 'CREATIVE',
        position: 2
      }
    })

    const helpCategory = await db.storylineCategory.create({
      data: {
        storylineId: storyline.id,
        name: 'HELP',
        position: 3
      }
    })

    // Create channels
    await db.storylineChannel.createMany({
      data: [
        // INFORMATION
        {
          storylineId: storyline.id,
          categoryId: infoCategory.id,
          name: 'announcements',
          type: 'announcement',
          position: 0,
          topic: 'Official announcements from the Chrona team'
        },
        {
          storylineId: storyline.id,
          categoryId: infoCategory.id,
          name: 'rules',
          type: 'text',
          position: 1,
          topic: 'Server rules and guidelines'
        },
        {
          storylineId: storyline.id,
          categoryId: infoCategory.id,
          name: 'welcome',
          type: 'text',
          position: 2,
          topic: 'Introduce yourself to the community!'
        },
        // GENERAL
        {
          storylineId: storyline.id,
          categoryId: generalCategory.id,
          name: 'general',
          type: 'text',
          position: 0,
          topic: 'General discussion about anything'
        },
        {
          storylineId: storyline.id,
          categoryId: generalCategory.id,
          name: 'introductions',
          type: 'text',
          position: 1,
          topic: 'Say hello and tell us about yourself'
        },
        {
          storylineId: storyline.id,
          categoryId: generalCategory.id,
          name: 'off-topic',
          type: 'text',
          position: 2,
          topic: 'Anything goes (within reason)!'
        },
        // CREATIVE
        {
          storylineId: storyline.id,
          categoryId: creativeCategory.id,
          name: 'share-your-characters',
          type: 'text',
          position: 0,
          topic: 'Show off your characters and personas'
        },
        {
          storylineId: storyline.id,
          categoryId: creativeCategory.id,
          name: 'art-showcase',
          type: 'text',
          position: 1,
          topic: 'Share your art and visual creations'
        },
        {
          storylineId: storyline.id,
          categoryId: creativeCategory.id,
          name: 'story-sharing',
          type: 'text',
          position: 2,
          topic: 'Share stories and writing'
        },
        // HELP
        {
          storylineId: storyline.id,
          categoryId: helpCategory.id,
          name: 'help-and-support',
          type: 'text',
          position: 0,
          topic: 'Get help with Chrona features'
        },
        {
          storylineId: storyline.id,
          categoryId: helpCategory.id,
          name: 'bug-reports',
          type: 'text',
          position: 1,
          topic: 'Report bugs and issues'
        },
        {
          storylineId: storyline.id,
          categoryId: helpCategory.id,
          name: 'feature-requests',
          type: 'text',
          position: 2,
          topic: 'Suggest new features and improvements'
        }
      ]
    })

    // Add system user as owner member
    await db.storylineMember.create({
      data: {
        storylineId: storyline.id,
        userId: systemUser.id,
        role: 'owner',
        roleId: ownerRole.id
      }
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Official community server created',
      storylineId: storyline.id
    })

  } catch (error) {
    console.error('Seed official server error:', error)
    return NextResponse.json({ error: 'Failed to seed official server' }, { status: 500 })
  }
}
