import { cookies, headers } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { db } from './db'
import bcrypt from 'bcryptjs'
import { randomBytes, scryptSync } from 'crypto'

// ===========================================
// Environment Variable Validation
// ===========================================

/**
 * Validates that required environment variables are set in production.
 * This function should be called at application startup.
 */
export function validateEnv(): void {
  const isProduction = process.env.NODE_ENV === 'production'
  
  const requiredInProduction = [
    { key: 'JWT_SECRET', value: process.env.JWT_SECRET },
    { key: 'DATABASE_URL', value: process.env.DATABASE_URL },
  ]
  
  if (isProduction) {
    const missing = requiredInProduction.filter(({ value }) => !value || value.includes('change-in-production'))
    
    if (missing.length > 0) {
      const missingKeys = missing.map(({ key }) => key).join(', ')
      throw new Error(
        `Missing or invalid required environment variables in production: ${missingKeys}. ` +
        `Please set these variables before starting the application.`
      )
    }
    
    // Validate JWT_SECRET strength in production
    const jwtSecret = process.env.JWT_SECRET
    if (jwtSecret && jwtSecret.length < 32) {
      console.warn(
        '[Auth] WARNING: JWT_SECRET should be at least 32 characters long in production for security.'
      )
    }
  }
}

// Validate env on module load (for server-side)
if (typeof window === 'undefined') {
  try {
    validateEnv()
  } catch (error) {
    console.error('[Auth] Environment validation failed:', error)
    // In development, just warn instead of throwing
    if (process.env.NODE_ENV === 'production') {
      throw error
    }
  }
}

// ===========================================
// JWT Configuration
// ===========================================

// In production, JWT_SECRET MUST be set via environment variable
const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET
  
  if (process.env.NODE_ENV === 'production') {
    if (!secret) {
      throw new Error(
        'JWT_SECRET environment variable is required in production. ' +
        'Generate a secure key with: openssl rand -base64 32'
      )
    }
    return secret
  }
  
  // Development fallback (not secure for production!)
  return secret || 'persona-dev-secret-key-not-for-production'
}

const SECRET_KEY = getJwtSecret()
const key = new TextEncoder().encode(SECRET_KEY)

export interface SessionUser {
  id: string
  email: string | null
  username: string
  avatarUrl: string | null
  role: string // user, mod, admin, owner
  dateOfBirth: string | null  // ISO date string or null
  securityVerified?: boolean  // Whether security key was verified this session
}

export interface StoredAccount {
  token: string
  user: SessionUser
}

export interface AccountsStore {
  accounts: Record<string, StoredAccount>
  activeAccountId: string | null
}

// Generate a secure random security key (16 characters, alphanumeric)
export function generateSecurityKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  // Removed confusing chars like I, O, 0, 1
  let key = ''
  const randomBytesBuffer = randomBytes(16)
  for (let i = 0; i < 16; i++) {
    key += chars[randomBytesBuffer[i] % chars.length]
  }
  // Format as XXXX-XXXX-XXXX-XXXX for readability
  return `${key.slice(0, 4)}-${key.slice(4, 8)}-${key.slice(8, 12)}-${key.slice(12, 16)}`
}

// Hash security key for storage
export function hashSecurityKey(securityKey: string): string {
  return scryptSync(securityKey, 'security-key-salt', 64).toString('hex')
}

// Verify security key
export function verifySecurityKey(securityKey: string, hashedKey: string): boolean {
  const hashedInput = scryptSync(securityKey, 'security-key-salt', 64).toString('hex')
  return hashedInput === hashedKey
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

// Verify password
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

// Create session token
export async function createSession(user: SessionUser): Promise<string> {
  const token = await new SignJWT({ user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // Session expires in 7 days
    .sign(key)
  
  return token
}

// Verify session token
export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, key)
    return payload.user as SessionUser
  } catch {
    return null
  }
}

// Get current session from cookies or Authorization header
export async function getSession(): Promise<SessionUser | null> {
  try {
    // First try Authorization header (for API calls with Bearer token)
    // This supports clients that send auth via header instead of cookies
    try {
      const headersList = await headers()
      const authHeader = headersList.get('Authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7)
        const user = await verifySession(token)
        if (user) return user
      }
    } catch {
      // headers() may not be available in all contexts
    }
    
    // Fall back to cookie session
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    
    if (!token) {
      return null
    }
    
    return verifySession(token)
  } catch (error) {
    console.error('[Auth] getSession error:', error)
    return null
  }
}

// Get session from Authorization header (for API calls with Bearer token)
export async function getSessionFromHeader(authHeader: string | null): Promise<SessionUser | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  
  const token = authHeader.slice(7) // Remove 'Bearer ' prefix
  return verifySession(token)
}

// Get session from either cookies or Authorization header
export async function getSessionFromRequest(req: Request): Promise<SessionUser | null> {
  // First try Authorization header
  const authHeader = req.headers.get('Authorization')
  if (authHeader) {
    const user = await getSessionFromHeader(authHeader)
    if (user) return user
  }
  
  // Fall back to cookies
  return getSession()
}

// Get session with fresh role from database (for admin checks)
export async function getSessionWithFreshRole(): Promise<SessionUser | null> {
  try {
    const sessionUser = await getSession()
    if (!sessionUser) return null
    
    // Fetch fresh role from database
    const dbUser = await db.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true }
    })
    
    if (!dbUser) return null
    
    // Return session with updated role
    return {
      ...sessionUser,
      role: dbUser.role
    }
  } catch (error) {
    console.error('[Auth] getSessionWithFreshRole error:', error)
    return null
  }
}

// Get session with fresh role from either Authorization header or cookies (for admin API calls)
export async function getSessionWithFreshRoleFromRequest(req: Request): Promise<SessionUser | null> {
  try {
    // First try Authorization header
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      const user = await getSessionFromHeader(authHeader)
      if (user) {
        // Fetch fresh role from database
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: { role: true }
        })
        
        if (dbUser) {
          return {
            ...user,
            role: dbUser.role
          }
        }
      }
    }
    
    // Fall back to cookies
    return getSessionWithFreshRole()
  } catch (error) {
    console.error('[Auth] getSessionWithFreshRoleFromRequest error:', error)
    return null
  }
}

// Set session cookie (active session)
export async function setSessionCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })
}

// Clear session cookie
export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
}

// ==================== MULTI-ACCOUNT FUNCTIONS ====================

// Get all stored accounts from cookie
export async function getAccountsStore(): Promise<AccountsStore> {
  try {
    const cookieStore = await cookies()
    const accountsJson = cookieStore.get('accounts')?.value
    
    if (!accountsJson) {
      return { accounts: {}, activeAccountId: null }
    }
    
    return JSON.parse(accountsJson)
  } catch (error) {
    console.error('[Auth] getAccountsStore error:', error)
    return { accounts: {}, activeAccountId: null }
  }
}

// Set accounts cookie
export async function setAccountsCookie(store: AccountsStore) {
  const cookieStore = await cookies()
  cookieStore.set('accounts', JSON.stringify(store), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days (longer for multi-account)
    path: '/',
  })
}

// Clear accounts cookie
export async function clearAccountsCookie() {
  const cookieStore = await cookies()
  cookieStore.delete('accounts')
}

// Add account to store (and set as active if first account)
export async function addAccountToStore(user: SessionUser, token: string): Promise<AccountsStore> {
  const store = await getAccountsStore()
  
  // Add or update the account
  store.accounts[user.id] = { token, user }
  
  // If this is the first account or no active account, set as active
  if (!store.activeAccountId || !store.accounts[store.activeAccountId]) {
    store.activeAccountId = user.id
  }
  
  // Save the store
  await setAccountsCookie(store)
  
  // Set as active session
  await setSessionCookie(token)
  
  return store
}

// Switch to a different account
export async function switchToAccount(userId: string): Promise<{ user: SessionUser; token: string } | null> {
  const store = await getAccountsStore()
  
  const account = store.accounts[userId]
  if (!account) {
    return null
  }
  
  // Verify the token is still valid
  const user = await verifySession(account.token)
  if (!user) {
    // Token expired, remove this account
    delete store.accounts[userId]
    await setAccountsCookie(store)
    return null
  }
  
  // Set as active
  store.activeAccountId = userId
  await setAccountsCookie(store)
  await setSessionCookie(account.token)
  
  return { user, token: account.token }
}

// Remove an account from store
export async function removeAccountFromStore(userId: string): Promise<{ success: boolean; switchedTo: SessionUser | null }> {
  const store = await getAccountsStore()
  
  if (!store.accounts[userId]) {
    return { success: false, switchedTo: null }
  }
  
  delete store.accounts[userId]
  
  // If we removed the active account, switch to another one
  let switchedTo: SessionUser | null = null
  
  if (store.activeAccountId === userId) {
    const remainingIds = Object.keys(store.accounts)
    
    if (remainingIds.length > 0) {
      // Switch to the first remaining account
      const newActiveId = remainingIds[0]
      store.activeAccountId = newActiveId
      switchedTo = await verifySession(store.accounts[newActiveId].token)
      
      if (switchedTo) {
        await setSessionCookie(store.accounts[newActiveId].token)
      }
    } else {
      store.activeAccountId = null
      await clearSessionCookie()
    }
  }
  
  await setAccountsCookie(store)
  
  return { success: true, switchedTo }
}

// Get all accounts (for account switcher UI)
export async function getAllAccounts(): Promise<{ accounts: StoredAccount[]; activeAccountId: string | null }> {
  const store = await getAccountsStore()
  const accounts = Object.values(store.accounts)
  
  // Filter out expired accounts
  const validAccounts: StoredAccount[] = []
  let needsUpdate = false
  
  for (const account of accounts) {
    const user = await verifySession(account.token)
    if (user) {
      validAccounts.push(account)
    } else {
      delete store.accounts[account.user.id]
      needsUpdate = true
    }
  }
  
  if (needsUpdate) {
    await setAccountsCookie(store)
  }
  
  return { accounts: validAccounts, activeAccountId: store.activeAccountId }
}

// ==================== USER AUTH FUNCTIONS ====================

// Authenticate user by username and password (returns user without security verification)
export async function authenticateUserByUsername(username: string, password: string): Promise<{ user: SessionUser; needsSecurityKey: boolean } | null> {
  const user = await db.user.findUnique({
    where: { username }
  })
  
  if (!user) return null
  
  const isValid = await verifyPassword(password, user.password)
  if (!isValid) return null
  
  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
      role: user.role,
      dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString() : null,
      securityVerified: false,
    },
    needsSecurityKey: true  // Always require security key
  }
}

// Verify security key for user
export async function verifyUserSecurityKey(userId: string, securityKey: string): Promise<SessionUser | null> {
  const user = await db.user.findUnique({
    where: { id: userId }
  })
  
  if (!user) return null
  
  const isValid = verifySecurityKey(securityKey, user.securityKey)
  if (!isValid) return null
  
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    avatarUrl: user.avatarUrl,
    role: user.role,
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString() : null,
    securityVerified: true,
  }
}

// Legacy: Authenticate user by email and password
export async function authenticateUser(email: string, password: string): Promise<SessionUser | null> {
  const user = await db.user.findUnique({
    where: { email }
  })
  
  if (!user) return null
  
  const isValid = await verifyPassword(password, user.password)
  if (!isValid) return null
  
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    avatarUrl: user.avatarUrl,
    role: user.role,
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString() : null,
  }
}

// Check if username exists
export async function usernameExists(username: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { username }
  })
  return !!user
}

// Check if email exists
export async function emailExists(email: string): Promise<boolean> {
  if (!email) return false
  const user = await db.user.findUnique({
    where: { email }
  })
  return !!user
}

// Check if a security key already exists in the database
export async function securityKeyExists(securityKey: string): Promise<boolean> {
  const hashedKey = hashSecurityKey(securityKey)
  const user = await db.user.findFirst({
    where: { securityKey: hashedKey }
  })
  return !!user
}

// Generate a unique security key (ensures no collision)
export async function generateUniqueSecurityKey(maxAttempts: number = 100): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const key = generateSecurityKey()
    const exists = await securityKeyExists(key)
    if (!exists) {
      return key
    }
  }
  throw new Error('Failed to generate unique security key after ' + maxAttempts + ' attempts')
}

// Change a user's security key (admin function)
export async function changeUserSecurityKey(userId: string): Promise<{ success: boolean; newKey?: string; error?: string }> {
  try {
    // Check if user exists
    const user = await db.user.findUnique({
      where: { id: userId }
    })
    
    if (!user) {
      return { success: false, error: 'User not found' }
    }
    
    // Generate a new unique security key
    const newKey = await generateUniqueSecurityKey()
    const hashedKey = hashSecurityKey(newKey)
    
    // Update the user's security key
    await db.user.update({
      where: { id: userId },
      data: { securityKey: hashedKey }
    })
    
    return { success: true, newKey }
  } catch (error) {
    console.error('[Auth] changeUserSecurityKey error:', error)
    return { success: false, error: 'Failed to change security key' }
  }
}

// Admin: Create user with specific role
export async function createUserWithRole(
  username: string,
  password: string,
  role: string,
  email?: string,
  dateOfBirth?: Date
): Promise<{ user: SessionUser; securityKey: string }> {
  const hashedPassword = await hashPassword(password)
  const securityKey = await generateUniqueSecurityKey()
  const hashedSecurityKey = hashSecurityKey(securityKey)
  
  const user = await db.user.create({
    data: {
      email: email || null,
      username,
      password: hashedPassword,
      securityKey: hashedSecurityKey,
      role: role as any,
      chronos: STARTING_CHRONOS,
      dateOfBirth: dateOfBirth || null,
    }
  })
  
  // Record the starting bonus as a transaction
  await db.chronosTransaction.create({
    data: {
      userId: user.id,
      amount: STARTING_CHRONOS,
      balance: STARTING_CHRONOS,
      type: 'bonus',
      category: 'welcome',
      description: 'Welcome bonus for new users',
    }
  })
  
  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
      role: user.role,
      dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString() : null,
    },
    securityKey,
  }
}

// Starting Chronos balance for new users
export const STARTING_CHRONOS = 100

// Create new user with username only (no email required)
export async function createUserWithUsername(
  username: string, 
  password: string,
  email?: string,
  dateOfBirth?: Date
): Promise<{ user: SessionUser; securityKey: string }> {
  const hashedPassword = await hashPassword(password)
  const securityKey = generateSecurityKey()
  const hashedSecurityKey = hashSecurityKey(securityKey)
  
  const user = await db.user.create({
    data: {
      email: email || null,
      username,
      password: hashedPassword,
      securityKey: hashedSecurityKey,
      chronos: STARTING_CHRONOS, // Give new users starting Chronos
      dateOfBirth: dateOfBirth || null,
    }
  })
  
  // Record the starting bonus as a transaction
  await db.chronosTransaction.create({
    data: {
      userId: user.id,
      amount: STARTING_CHRONOS,
      balance: STARTING_CHRONOS,
      type: 'bonus',
      category: 'welcome',
      description: 'Welcome bonus for new users',
    }
  })
  
  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
      role: user.role,
      dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString() : null,
    },
    securityKey,  // Return the plain key to show ONCE
  }
}

// Legacy: Create new user with email
export async function createUser(email: string, username: string, password: string): Promise<SessionUser> {
  const hashedPassword = await hashPassword(password)
  const securityKey = generateSecurityKey()
  const hashedSecurityKey = hashSecurityKey(securityKey)
  
  const user = await db.user.create({
    data: {
      email,
      username,
      password: hashedPassword,
      securityKey: hashedSecurityKey,
      chronos: STARTING_CHRONOS, // Give new users starting Chronos
    }
  })
  
  // Record the starting bonus as a transaction
  await db.chronosTransaction.create({
    data: {
      userId: user.id,
      amount: STARTING_CHRONOS,
      balance: STARTING_CHRONOS,
      type: 'bonus',
      category: 'welcome',
      description: 'Welcome bonus for new users',
    }
  })
  
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    avatarUrl: user.avatarUrl,
    role: user.role,
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString() : null,
  }
}
