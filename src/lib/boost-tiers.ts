// Tier thresholds: index = tier, value = chronos required
// Tier 0 = 0 chronos (default), Tier 1 = 200, etc.
export const TIER_THRESHOLDS = [0, 200, 500, 1000, 1200, 1500, 2000, 2200, 2500, 3000, 3200, 3500, 4000, 4200]

// Maximum tier level
export const MAX_TIER = 13

// Valid boost amounts
export const BOOST_AMOUNTS = [200, 500, 1000] as const
export type BoostAmount = typeof BOOST_AMOUNTS[number]

// Boost duration in days
export const BOOST_DURATION_DAYS = 30

/**
 * Returns the tier (0-13) based on the total active Chronos
 */
export function getTierFromChronos(chronos: number): number {
  if (chronos < 0) return 0
  
  // Find the highest tier where chronos >= threshold
  for (let tier = MAX_TIER; tier >= 0; tier--) {
    if (chronos >= TIER_THRESHOLDS[tier]) {
      return tier
    }
  }
  return 0
}

/**
 * Returns progress (0-1) between current tier and next tier
 * Returns 1 if at max tier
 */
export function getTierProgress(chronos: number): number {
  const currentTier = getTierFromChronos(chronos)
  
  // At max tier, progress is 100%
  if (currentTier >= MAX_TIER) return 1
  
  const currentThreshold = TIER_THRESHOLDS[currentTier]
  const nextThreshold = TIER_THRESHOLDS[currentTier + 1]
  
  if (nextThreshold === currentThreshold) return 1
  
  const progress = (chronos - currentThreshold) / (nextThreshold - currentThreshold)
  return Math.min(1, Math.max(0, progress))
}

/**
 * Returns the Chronos needed for the next tier
 * Returns null if at max tier
 */
export function getNextTierThreshold(currentTier: number): number | null {
  if (currentTier >= MAX_TIER) return null
  return TIER_THRESHOLDS[currentTier + 1]
}

/**
 * Returns the current tier's threshold
 */
export function getCurrentTierThreshold(currentTier: number): number {
  if (currentTier < 0 || currentTier > MAX_TIER) return 0
  return TIER_THRESHOLDS[currentTier]
}

/**
 * Returns how many chronos are needed to reach the next tier from current chronos
 */
export function getChronosToNextTier(chronos: number): number | null {
  const currentTier = getTierFromChronos(chronos)
  const nextThreshold = getNextTierThreshold(currentTier)
  
  if (nextThreshold === null) return null
  return Math.max(0, nextThreshold - chronos)
}

/**
 * Get tier display info
 */
export function getTierInfo(chronos: number): {
  tier: number
  currentThreshold: number
  nextThreshold: number | null
  progress: number
  chronosToNext: number | null
} {
  const tier = getTierFromChronos(chronos)
  const currentThreshold = getCurrentTierThreshold(tier)
  const nextThreshold = getNextTierThreshold(tier)
  const progress = getTierProgress(chronos)
  const chronosToNext = getChronosToNextTier(chronos)
  
  return {
    tier,
    currentThreshold,
    nextThreshold,
    progress,
    chronosToNext
  }
}

/**
 * Calculate expiry date for a new boost (30 days from now)
 */
export function calculateBoostExpiry(): Date {
  const expiry = new Date()
  expiry.setDate(expiry.getDate() + BOOST_DURATION_DAYS)
  return expiry
}
