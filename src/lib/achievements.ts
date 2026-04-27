// ========================================
// Achievement & Badge System
// ========================================

// Achievement category types
export type AchievementCategory = 'social' | 'creative' | 'storytelling' | 'storylines' | 'economy' | 'special'

// Achievement definition interface
export interface AchievementDefinition {
  key: string
  name: string
  description: string
  icon: string // emoji
  category: AchievementCategory
  tier: number // 1 = bronze, 2 = silver, 3 = gold
  requirement: number // target value to complete
  isHidden: boolean // hidden until earned
}

// All achievement definitions
export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // === Social ===
  {
    key: 'first_friend',
    name: 'First Connection',
    description: 'Add your first friend',
    icon: '🤝',
    category: 'social',
    tier: 1,
    requirement: 1,
    isHidden: false,
  },
  {
    key: 'friend_collector',
    name: 'Friend Collector',
    description: 'Add 10 friends',
    icon: '👥',
    category: 'social',
    tier: 2,
    requirement: 10,
    isHidden: false,
  },
  {
    key: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Add 25 friends',
    icon: '🦋',
    category: 'social',
    tier: 3,
    requirement: 25,
    isHidden: false,
  },

  // === Creative ===
  {
    key: 'first_persona',
    name: 'First Character',
    description: 'Create your first character',
    icon: '🎭',
    category: 'creative',
    tier: 1,
    requirement: 1,
    isHidden: false,
  },
  {
    key: 'character_builder',
    name: 'Character Builder',
    description: 'Create 5 characters',
    icon: '🏗️',
    category: 'creative',
    tier: 2,
    requirement: 5,
    isHidden: false,
  },
  {
    key: 'persona_master',
    name: 'Persona Master',
    description: 'Create 10 characters',
    icon: '👑',
    category: 'creative',
    tier: 3,
    requirement: 10,
    isHidden: false,
  },

  // === Storytelling ===
  {
    key: 'first_message',
    name: 'First Message',
    description: 'Send your first message',
    icon: '💬',
    category: 'storytelling',
    tier: 1,
    requirement: 1,
    isHidden: false,
  },
  {
    key: 'chatterbox',
    name: 'Chatterbox',
    description: 'Send 100 messages',
    icon: '🗣️',
    category: 'storytelling',
    tier: 2,
    requirement: 100,
    isHidden: false,
  },
  {
    key: 'wordsmith',
    name: 'Wordsmith',
    description: 'Send 500 messages',
    icon: '✍️',
    category: 'storytelling',
    tier: 3,
    requirement: 500,
    isHidden: false,
  },
  {
    key: 'conversationalist',
    name: 'Conversationalist',
    description: 'Send 1000 messages',
    icon: '🏅',
    category: 'storytelling',
    tier: 3,
    requirement: 1000,
    isHidden: true,
  },

  // === Storylines ===
  {
    key: 'first_storyline',
    name: 'First Storyline',
    description: 'Join your first storyline',
    icon: '📖',
    category: 'storylines',
    tier: 1,
    requirement: 1,
    isHidden: false,
  },
  {
    key: 'storyline_veteran',
    name: 'Storyline Veteran',
    description: 'Join 5 storylines',
    icon: '⚔️',
    category: 'storylines',
    tier: 2,
    requirement: 5,
    isHidden: false,
  },
  {
    key: 'storyline_owner',
    name: 'Storyline Owner',
    description: 'Create a storyline',
    icon: '🏰',
    category: 'storylines',
    tier: 2,
    requirement: 1,
    isHidden: false,
  },

  // === Economy ===
  {
    key: 'first_purchase',
    name: 'First Purchase',
    description: 'Make your first Chronos purchase',
    icon: '🛒',
    category: 'economy',
    tier: 1,
    requirement: 1,
    isHidden: false,
  },
  {
    key: 'daily_claimer',
    name: 'Daily Claimer',
    description: 'Claim daily bonus 7 days in a row',
    icon: '📅',
    category: 'economy',
    tier: 2,
    requirement: 7,
    isHidden: false,
  },
  {
    key: 'chronos_rich',
    name: 'Chronos Rich',
    description: 'Earn 1000 Chronos total',
    icon: '💰',
    category: 'economy',
    tier: 3,
    requirement: 1000,
    isHidden: false,
  },

  // === Special ===
  {
    key: 'early_adopter',
    name: 'Early Adopter',
    description: 'Created account in the first month',
    icon: '🌟',
    category: 'special',
    tier: 3,
    requirement: 1,
    isHidden: true,
  },
  {
    key: 'verified',
    name: 'Verified',
    description: 'Set a profile avatar',
    icon: '✅',
    category: 'special',
    tier: 1,
    requirement: 1,
    isHidden: false,
  },
]

// Category display names and emojis
export const CATEGORY_INFO: Record<AchievementCategory, { label: string; emoji: string; color: string }> = {
  social: { label: 'Social', emoji: '🤝', color: 'from-blue-500 to-cyan-400' },
  creative: { label: 'Creative', emoji: '🎭', color: 'from-purple-500 to-pink-400' },
  storytelling: { label: 'Storytelling', emoji: '💬', color: 'from-teal-500 to-emerald-400' },
  storylines: { label: 'Storylines', emoji: '📖', color: 'from-amber-500 to-orange-400' },
  economy: { label: 'Economy', emoji: '💰', color: 'from-yellow-500 to-amber-400' },
  special: { label: 'Special', emoji: '✨', color: 'from-rose-500 to-pink-400' },
}

// Tier display info
export const TIER_INFO: Record<number, { label: string; color: string }> = {
  1: { label: 'Bronze', color: 'from-amber-700 to-amber-500' },
  2: { label: 'Silver', color: 'from-slate-400 to-slate-300' },
  3: { label: 'Gold', color: 'from-yellow-500 to-amber-400' },
}

/**
 * Check and award achievements for a user based on a category trigger.
 * Returns list of newly earned achievement keys.
 */
export async function checkAndAwardAchievements(
  userId: string,
  category: string,
  db: any
): Promise<string[]> {
  const newlyEarned: string[] = []

  // Get all achievements in this category
  const achievements = await db.achievement.findMany({
    where: {
      category,
      isActive: true,
    },
  })

  if (achievements.length === 0) return newlyEarned

  // Get user's existing achievement progress
  const userAchievements = await db.userAchievement.findMany({
    where: {
      userId,
      achievementId: { in: achievements.map((a: any) => a.id) },
    },
  })

  const userAchievementMap = new Map(
    userAchievements.map((ua: any) => [ua.achievementId, ua])
  )

  // Calculate current progress for each achievement in the category
  const progressValues = await calculateCategoryProgress(userId, category, db)

  for (const achievement of achievements) {
    const existingUA = userAchievementMap.get(achievement.id)
    const currentProgress = progressValues[achievement.key] ?? 0

    if (existingUA) {
      // Already has this achievement tracked
      if (existingUA.completed) continue // Already completed

      // Update progress
      const isNowCompleted = currentProgress >= achievement.requirement
      await db.userAchievement.update({
        where: { id: existingUA.id },
        data: {
          progress: Math.min(currentProgress, achievement.requirement),
          completed: isNowCompleted,
          completedAt: isNowCompleted ? new Date() : null,
          updatedAt: new Date(),
        },
      })

      if (isNowCompleted) {
        newlyEarned.push(achievement.key)
      }
    } else {
      // No tracking yet — create it
      const isNowCompleted = currentProgress >= achievement.requirement
      await db.userAchievement.create({
        data: {
          userId,
          achievementId: achievement.id,
          progress: Math.min(currentProgress, achievement.requirement),
          completed: isNowCompleted,
          completedAt: isNowCompleted ? new Date() : null,
        },
      })

      if (isNowCompleted) {
        newlyEarned.push(achievement.key)
      }
    }
  }

  return newlyEarned
}

/**
 * Calculate the current progress values for all achievements in a category.
 * Returns a map of achievement key -> current progress value.
 */
async function calculateCategoryProgress(
  userId: string,
  category: string,
  db: any
): Promise<Record<string, number>> {
  const progress: Record<string, number> = {}

  switch (category) {
    case 'social': {
      // Count friends
      const friendCount = await db.friendship.count({
        where: { userId },
      })
      progress['first_friend'] = friendCount
      progress['friend_collector'] = friendCount
      progress['social_butterfly'] = friendCount
      break
    }

    case 'creative': {
      // Count personas
      const personaCount = await db.persona.count({
        where: { userId },
      })
      progress['first_persona'] = personaCount
      progress['character_builder'] = personaCount
      progress['persona_master'] = personaCount
      break
    }

    case 'storytelling': {
      // Count messages sent by user's personas
      const userPersonas = await db.persona.findMany({
        where: { userId },
        select: { id: true },
      })
      const personaIds = userPersonas.map((p: any) => p.id)

      // DM messages
      const dmMessageCount = personaIds.length > 0
        ? await db.message.count({
            where: { senderId: { in: personaIds } },
          })
        : 0

      // Storyline messages
      const storylineMessageCount = personaIds.length > 0
        ? await db.storylineMessage.count({
            where: { senderId: { in: personaIds } },
          })
        : 0

      const totalMessages = dmMessageCount + storylineMessageCount
      progress['first_message'] = totalMessages
      progress['chatterbox'] = totalMessages
      progress['wordsmith'] = totalMessages
      progress['conversationalist'] = totalMessages
      break
    }

    case 'storylines': {
      // Joined storylines count
      const joinedCount = await db.storylineMember.count({
        where: { userId },
      })
      progress['first_storyline'] = joinedCount
      progress['storyline_veteran'] = joinedCount

      // Created storylines count
      const ownedCount = await db.storyline.count({
        where: { ownerId: userId },
      })
      progress['storyline_owner'] = ownedCount
      break
    }

    case 'economy': {
      // First purchase
      const purchaseCount = await db.chronosTransaction.count({
        where: {
          userId,
          category: 'purchase',
        },
      })
      progress['first_purchase'] = purchaseCount

      // Daily claim streak
      const dailyClaims = await db.chronosTransaction.findMany({
        where: {
          userId,
          category: 'daily_bonus',
        },
        orderBy: { createdAt: 'desc' },
        take: 30, // Look at last 30 claims
        select: { createdAt: true },
      })
      progress['daily_claimer'] = calculateDailyStreak(dailyClaims.map((c: any) => new Date(c.createdAt)))

      // Total Chronos earned
      const totalEarned = await db.chronosTransaction.aggregate({
        where: {
          userId,
          amount: { gt: 0 },
          category: { notIn: ['purchase', 'gift_sent'] },
        },
        _sum: { amount: true },
      })
      progress['chronos_rich'] = totalEarned._sum.amount ?? 0
      break
    }

    case 'special': {
      // Early adopter - account created in first month of platform
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { createdAt: true, avatarUrl: true },
      })

      if (user) {
        // Check if account was created within 30 days of the first user (platform launch)
        const firstUser = await db.user.findFirst({
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        })
        
        if (firstUser) {
          const platformLaunch = new Date(firstUser.createdAt)
          const userCreated = new Date(user.createdAt)
          const thirtyDaysAfterLaunch = new Date(platformLaunch.getTime() + 30 * 24 * 60 * 60 * 1000)
          progress['early_adopter'] = userCreated <= thirtyDaysAfterLaunch ? 1 : 0
        } else {
          progress['early_adopter'] = 0
        }

        // Verified - has avatar
        progress['verified'] = user.avatarUrl ? 1 : 0
      }
      break
    }
  }

  return progress
}

/**
 * Calculate consecutive daily streak from a list of claim dates.
 * Returns the streak count (max 7 for the achievement).
 */
function calculateDailyStreak(claimDates: Date[]): number {
  if (claimDates.length === 0) return 0

  let streak = 1
  const sortedDates = claimDates
    .map(d => {
      const date = new Date(d)
      return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    })
    .sort((a, b) => b - a) // descending

  // Remove duplicates (same day)
  const uniqueDays = [...new Set(sortedDates)]

  for (let i = 1; i < uniqueDays.length; i++) {
    const diff = uniqueDays[i - 1] - uniqueDays[i]
    const oneDay = 24 * 60 * 60 * 1000
    if (diff === oneDay) {
      streak++
    } else {
      break
    }
  }

  return streak
}
