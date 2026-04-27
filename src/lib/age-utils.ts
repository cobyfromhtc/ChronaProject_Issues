// ========================================
// Age Verification & Safety Utilities
// ========================================
// This module provides all age-related calculations and checks
// for the Chrona platform's age verification and safety system.

// Platform age constants
export const MINIMUM_AGE = 16    // Minimum age to use the platform
export const ADULT_AGE = 18      // Age at which user is considered an adult for content purposes

// Age bracket types
export type AgeBracket = 'minor' | 'adult'

// Content maturity levels
export type ContentMaturity = 'safe' | 'mature' | 'unrestricted'

/**
 * Calculate a user's exact age from their date of birth.
 * Accounts for leap years and birthday not yet occurred this year.
 */
export function calculateAge(dateOfBirth: Date): number {
  const today = new Date()
  const dob = new Date(dateOfBirth)
  
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  
  // If birthday hasn't occurred yet this year, subtract 1
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--
  }
  
  return age
}

/**
 * Get the age bracket for a user based on their date of birth.
 * - 'minor': 16-17 years old
 * - 'adult': 18+ years old
 */
export function getAgeBracket(dateOfBirth: Date | null | undefined): AgeBracket {
  if (!dateOfBirth) return 'minor' // Default to minor for safety if DOB not set
  const age = calculateAge(dateOfBirth)
  return age >= ADULT_AGE ? 'adult' : 'minor'
}

/**
 * Check if a user is an adult (18+)
 */
export function isAdult(dateOfBirth: Date | null | undefined): boolean {
  return getAgeBracket(dateOfBirth) === 'adult'
}

/**
 * Check if a user is a minor (16-17)
 */
export function isMinor(dateOfBirth: Date | null | undefined): boolean {
  return getAgeBracket(dateOfBirth) === 'minor'
}

/**
 * Check if a user meets the minimum age requirement (16+)
 */
export function meetsMinimumAge(dateOfBirth: Date): boolean {
  return calculateAge(dateOfBirth) >= MINIMUM_AGE
}

/**
 * Check if a user is allowed to access NSFW features (18+)
 */
export function isNsfwAllowed(dateOfBirth: Date | null | undefined): boolean {
  return isAdult(dateOfBirth)
}

/**
 * Check if two users can interact based on their age brackets.
 * Users can only interact if they are in the same age bracket.
 * This means:
 * - Minors (16-17) can only interact with other minors
 * - Adults (18+) can only interact with other adults
 */
export function canInteract(dobA: Date | null | undefined, dobB: Date | null | undefined): boolean {
  return getAgeBracket(dobA) === getAgeBracket(dobB)
}

/**
 * Get the allowed content maturity levels for a user based on their age.
 * - Minors: Only "safe"
 * - Adults: "safe", "mature", "unrestricted"
 */
export function getAllowedMaturityLevels(dateOfBirth: Date | null | undefined): ContentMaturity[] {
  if (isMinor(dateOfBirth)) {
    return ['safe']
  }
  return ['safe', 'mature', 'unrestricted']
}

/**
 * Get the maximum content maturity level for a user.
 * - Minors: "safe"
 * - Adults: "unrestricted"
 */
export function getMaxMaturityLevel(dateOfBirth: Date | null | undefined): ContentMaturity {
  if (isMinor(dateOfBirth)) {
    return 'safe'
  }
  return 'unrestricted'
}

/**
 * Validate and sanitize a content maturity setting for a user.
 * If the user is a minor trying to set a non-safe maturity, force to "safe".
 */
export function sanitizeContentMaturity(
  dateOfBirth: Date | null | undefined,
  requestedMaturity: string
): ContentMaturity {
  const allowed = getAllowedMaturityLevels(dateOfBirth)
  if (allowed.includes(requestedMaturity as ContentMaturity)) {
    return requestedMaturity as ContentMaturity
  }
  return 'safe' // Default to safe if not allowed
}

/**
 * Check if a user can create an adult storyline
 */
export function canCreateAdultStoryline(dateOfBirth: Date | null | undefined): boolean {
  return isAdult(dateOfBirth)
}

/**
 * Check if a user can join an adult storyline
 */
export function canJoinAdultStoryline(dateOfBirth: Date | null | undefined): boolean {
  return isAdult(dateOfBirth)
}

/**
 * Check if a user can enable NSFW on their persona
 */
export function canEnableNsfw(dateOfBirth: Date | null | undefined): boolean {
  return isAdult(dateOfBirth)
}

/**
 * Get a human-readable age bracket label
 */
export function getAgeBracketLabel(dateOfBirth: Date | null | undefined): string {
  const bracket = getAgeBracket(dateOfBirth)
  switch (bracket) {
    case 'minor':
      return '16-17'
    case 'adult':
      return '18+'
    default:
      return 'Unknown'
  }
}

/**
 * Validate a date of birth for signup.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateDateOfBirth(day: number, month: number, year: number): string | null {
  // Check if the date is valid
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return 'Invalid date of birth'
  }
  
  // Check if the date is in the future
  const today = new Date()
  if (date > today) {
    return 'Date of birth cannot be in the future'
  }
  
  // Check minimum age
  const age = calculateAge(date)
  if (age < MINIMUM_AGE) {
    return `You must be at least ${MINIMUM_AGE} years old to use Chrona`
  }
  
  // Check maximum age (reasonable upper limit)
  if (age > 120) {
    return 'Please enter a valid date of birth'
  }
  
  return null // Valid
}

/**
 * Create a Date object from day, month, year components
 */
export function createDateFromComponents(day: number, month: number, year: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0) // Noon to avoid timezone issues
}

/**
 * Get the day, month, year from a Date object
 */
export function getDateComponents(date: Date): { day: number; month: number; year: number } {
  return {
    day: date.getDate(),
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  }
}
