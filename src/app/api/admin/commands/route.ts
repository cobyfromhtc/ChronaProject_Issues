import { NextRequest, NextResponse } from 'next/server'
import { getSessionWithFreshRoleFromRequest } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  createUserWithRole,
  changeUserSecurityKey,
  usernameExists
} from '@/lib/auth'
import {
  ROLES, getRole, getRoleLabel, getRoleLevel, getRoleColor,
  isStaff, isModerator, isAdmin, isExecutive,
  canManageRole, getAssignableRoles, ALL_ROLE_IDS
} from '@/lib/roles'
import { sendBlorpMessage, ensureBlorpExists } from '@/lib/blorp'

// Import moderation command handlers
import {
  handleWarn,
  handleMute,
  handleUnmute,
  handleClearWarnings,
  handleFreeze,
  handleUnfreeze,
  handleSuspend,
  handleUnsuspend,
  handleBan,
  handleUnban,
  handleTerminate,
  handleViewHistory,
  handleKick,
  handleModNote,
  handleModHelp,
  handleBlorpDM,
  CommandResult
} from '@/lib/modCommands'

// Valid roles that can be assigned
const VALID_ROLES = ALL_ROLE_IDS

interface CommandResult {
  success: boolean
  message: string
  data?: Record<string, unknown>
}

// Parse command string
function parseCommand(input: string): { command: string; args: string[] } | null {
  const trimmed = input.trim()
  
  // Check if it starts with a dash (command prefix)
  if (!trimmed.startsWith('-')) {
    return null
  }
  
  // Split by spaces, but keep quoted strings together
  const parts: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i]
    
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ' ' && !inQuotes) {
      if (current) {
        parts.push(current)
        current = ''
      }
    } else {
      current += char
    }
  }
  
  if (current) {
    parts.push(current)
  }
  
  if (parts.length === 0) return null
  
  const command = parts[0].toLowerCase()
  const args = parts.slice(1)
  
  return { command, args }
}

// CreateAccount command: -CreateAccount Username, Password, Role
async function handleCreateAccount(args: string[], userRole: string): Promise<CommandResult> {
  // Only staff can create accounts
  if (!isStaff(userRole)) {
    return { success: false, message: 'Only staff members can create accounts' }
  }
  
  if (args.length < 2) {
    return {
      success: false,
      message: 'Usage: -CreateAccount Username, Password, Role\nExample: -CreateAccount TestUser, password123, member'
    }
  }
  
  // Parse arguments - they can be comma-separated or space-separated
  let username: string, password: string, role: string
  
  if (args.length === 1 && args[0].includes(',')) {
    // Comma-separated format: "Username, Password, Role"
    const parts = args[0].split(',').map(s => s.trim())
    username = parts[0]
    password = parts[1] || ''
    role = (parts[2] || 'member').toLowerCase()
  } else {
    // Space-separated or mixed
    const allArgs = args.join(' ')
    if (allArgs.includes(',')) {
      const parts = allArgs.split(',').map(s => s.trim())
      username = parts[0]
      password = parts[1] || ''
      role = (parts[2] || 'member').toLowerCase()
    } else {
      username = args[0]
      password = args[1]
      role = (args[2] || 'member').toLowerCase()
    }
  }
  
  // Validation
  if (!username || username.length < 3) {
    return { success: false, message: 'Username must be at least 3 characters' }
  }
  
  if (!password || password.length < 6) {
    return { success: false, message: 'Password must be at least 6 characters' }
  }
  
  if (!VALID_ROLES.includes(role as any)) {
    return { success: false, message: `Invalid role. Use -Help to see valid roles.` }
  }
  
  // Check if user can assign this role
  const actorLevel = getRoleLevel(userRole)
  const targetLevel = getRoleLevel(role)
  
  if (actorLevel <= targetLevel) {
    return { success: false, message: `You cannot create accounts with role equal to or higher than your own.` }
  }
  
  // Check if username exists
  const exists = await usernameExists(username)
  if (exists) {
    return { success: false, message: `Username "${username}" already exists` }
  }
  
  try {
    const result = await createUserWithRole(username, password, role)
    
    return {
      success: true,
      message: `Account created successfully!\nUsername: ${username}\nRole: ${getRoleLabel(role)}\nSecurity Key: ${result.securityKey}\n\n⚠️ Save this security key - it cannot be recovered!`,
      data: {
        user: result.user,
        securityKey: result.securityKey
      }
    }
  } catch (error) {
    console.error('CreateAccount error:', error)
    return { success: false, message: 'Failed to create account' }
  }
}

// ChangeKey command: -ChangeKey Username
async function handleChangeKey(args: string[], userRole: string): Promise<CommandResult> {
  // Only admins and owners can change security keys
  if (!isAdmin(userRole)) {
    return { success: false, message: 'Only administrators and executives can change security keys' }
  }
  
  if (args.length < 1) {
    return {
      success: false,
      message: 'Usage: -ChangeKey Username\nExample: -ChangeKey TestUser'
    }
  }
  
  const username = args[0].replace(/,/g, '').trim()
  
  if (!username) {
    return { success: false, message: 'Username is required' }
  }
  
  try {
    // Find user by username
    const user = await db.user.findUnique({
      where: { username }
    })
    
    if (!user) {
      return { success: false, message: `User "${username}" not found` }
    }
    
    const result = await changeUserSecurityKey(user.id)
    
    if (!result.success) {
      return { success: false, message: result.error || 'Failed to change security key' }
    }
    
    return {
      success: true,
      message: `Security key changed for "${username}"!\nNew Security Key: ${result.newKey}\n\n⚠️ Save this security key - it cannot be recovered!`,
      data: {
        username,
        newKey: result.newKey
      }
    }
  } catch (error) {
    console.error('ChangeKey error:', error)
    return { success: false, message: 'Failed to change security key' }
  }
}

// GetUserInfo command: -GetUserInfo Username
async function handleGetUserInfo(args: string[]): Promise<CommandResult> {
  if (args.length < 1) {
    return {
      success: false,
      message: 'Usage: -GetUserInfo Username\nExample: -GetUserInfo TestUser'
    }
  }
  
  const username = args[0].replace(/,/g, '').trim()
  
  try {
    const user = await db.user.findUnique({
      where: { username },
      include: {
        _count: {
          select: {
            personas: true,
            storylineMembers: true,
            friends: true,
          }
        }
      }
    })
    
    if (!user) {
      return { success: false, message: `User "${username}" not found` }
    }
    
    return {
      success: true,
      message: `User Info:\nID: ${user.id}\nUsername: ${user.username}\nRole: ${user.role}\nChronos: ${user.chronos}\nPersonas: ${user._count.personas}\nStorylines: ${user._count.storylineMembers}\nFriends: ${user._count.friends}\nCreated: ${new Date(user.createdAt).toLocaleDateString()}`,
      data: {
        id: user.id,
        username: user.username,
        role: user.role,
        chronos: user.chronos,
        personas: user._count.personas,
        storylines: user._count.storylineMembers,
        friends: user._count.friends,
        createdAt: user.createdAt
      }
    }
  } catch (error) {
    console.error('GetUserInfo error:', error)
    return { success: false, message: 'Failed to get user info' }
  }
}

// DeleteUser command: -DeleteUser Username
async function handleDeleteUser(args: string[], userRole: string): Promise<CommandResult> {
  // Only executives can delete users
  if (!isExecutive(userRole)) {
    return { success: false, message: 'Only executives can delete users' }
  }
  
  if (args.length < 1) {
    return {
      success: false,
      message: 'Usage: -DeleteUser Username\nExample: -DeleteUser TestUser'
    }
  }
  
  const username = args[0].replace(/,/g, '').trim()
  
  try {
    const user = await db.user.findUnique({
      where: { username }
    })
    
    if (!user) {
      return { success: false, message: `User "${username}" not found` }
    }
    
    // Check permissions using role levels
    const actorLevel = getRoleLevel(userRole)
    const targetLevel = getRoleLevel(user.role)
    
    // Can't delete someone with higher or equal role
    if (actorLevel <= targetLevel) {
      return { success: false, message: 'Cannot delete users with equal or higher role than yourself' }
    }
    
    await db.user.delete({
      where: { id: user.id }
    })
    
    return {
      success: true,
      message: `User "${username}" has been deleted`
    }
  } catch (error) {
    console.error('DeleteUser error:', error)
    return { success: false, message: 'Failed to delete user' }
  }
}

// SetRole command: -SetRole Username, Role
async function handleSetRole(args: string[], userRole: string): Promise<CommandResult> {
  // Only admin+ can change roles
  if (!isAdmin(userRole)) {
    return { success: false, message: 'Only administrators and executives can change roles' }
  }
  
  if (args.length < 2) {
    return {
      success: false,
      message: 'Usage: -SetRole Username, Role\nExample: -SetRole TestUser, mod\nUse -Help to see all available roles.'
    }
  }
  
  // Parse arguments
  let username: string, role: string
  
  if (args.length === 1 && args[0].includes(',')) {
    const parts = args[0].split(',').map(s => s.trim())
    username = parts[0]
    role = (parts[1] || '').toLowerCase()
  } else {
    const allArgs = args.join(' ')
    if (allArgs.includes(',')) {
      const parts = allArgs.split(',').map(s => s.trim())
      username = parts[0]
      role = (parts[1] || '').toLowerCase()
    } else {
      username = args[0]
      role = (args[1] || '').toLowerCase()
    }
  }
  
  if (!VALID_ROLES.includes(role as any)) {
    return { success: false, message: `Invalid role. Use -Help to see valid roles.` }
  }
  
  try {
    const user = await db.user.findUnique({
      where: { username }
    })
    
    if (!user) {
      return { success: false, message: `User "${username}" not found` }
    }
    
    // Check permissions using role levels
    const actorLevel = getRoleLevel(userRole)
    const targetCurrentLevel = getRoleLevel(user.role)
    const targetNewLevel = getRoleLevel(role)
    
    // Can't modify someone with higher or equal role
    if (actorLevel <= targetCurrentLevel) {
      return { success: false, message: 'You cannot modify users with equal or higher role than yourself' }
    }
    
    // Can't assign a role higher or equal to own role
    if (actorLevel <= targetNewLevel) {
      return { success: false, message: 'You cannot assign roles equal to or higher than your own' }
    }
    
    await db.user.update({
      where: { id: user.id },
      data: { role: role as any }
    })
    
    return {
      success: true,
      message: `Role changed for "${username}" from ${getRoleLabel(user.role)} to ${getRoleLabel(role)}`
    }
  } catch (error) {
    console.error('SetRole error:', error)
    return { success: false, message: 'Failed to change role' }
  }
}

// GiveChronos command: -GiveChronos Username, Amount
async function handleGiveChronos(args: string[]): Promise<CommandResult> {
  if (args.length < 2) {
    return {
      success: false,
      message: 'Usage: -GiveChronos Username, Amount\nExample: -GiveChronos TestUser, 500'
    }
  }
  
  // Parse arguments
  let username: string, amountStr: string
  
  if (args.length === 1 && args[0].includes(',')) {
    const parts = args[0].split(',').map(s => s.trim())
    username = parts[0]
    amountStr = parts[1] || '0'
  } else {
    const allArgs = args.join(' ')
    if (allArgs.includes(',')) {
      const parts = allArgs.split(',').map(s => s.trim())
      username = parts[0]
      amountStr = parts[1] || '0'
    } else {
      username = args[0]
      amountStr = args[1]
    }
  }
  
  const amount = parseInt(amountStr.replace(/,/g, ''))
  
  if (isNaN(amount) || amount === 0) {
    return { success: false, message: 'Amount must be a non-zero number' }
  }
  
  try {
    const user = await db.user.findUnique({
      where: { username }
    })
    
    if (!user) {
      return { success: false, message: `User "${username}" not found` }
    }
    
    const newBalance = user.chronos + amount
    
    // Update user balance
    await db.user.update({
      where: { id: user.id },
      data: { chronos: newBalance }
    })
    
    // Record transaction
    await db.chronosTransaction.create({
      data: {
        userId: user.id,
        amount: amount,
        balance: newBalance,
        type: amount > 0 ? 'admin_grant' : 'admin_deduct',
        category: 'admin',
        description: amount > 0 ? 'Admin granted Chronos' : 'Admin deducted Chronos'
      }
    })

    // Send Blorp message to user (async, don't block)
    ensureBlorpExists().then(() => {
      if (amount > 0) {
        sendBlorpMessage(user.id, {
          type: 'chronos_granted',
          amount,
          adminName: 'Chrona Staff',
          reason: 'Granted by administrator'
        }).catch(err => console.error('Failed to send Blorp message:', err))
      } else {
        sendBlorpMessage(user.id, {
          type: 'chronos_deducted',
          amount: Math.abs(amount),
          reason: 'Adjusted by administrator'
        }).catch(err => console.error('Failed to send Blorp message:', err))
      }
    })

    return {
      success: true,
      message: `${amount > 0 ? 'Given' : 'Deducted'} ${Math.abs(amount)} Chronos ${amount > 0 ? 'to' : 'from'} "${username}"\nNew balance: ${newBalance}`
    }
  } catch (error) {
    console.error('GiveChronos error:', error)
    return { success: false, message: 'Failed to modify Chronos' }
  }
}

// GivePersona command: -GivePersona Username, PersonaID
async function handleGivePersona(args: string[]): Promise<CommandResult> {
  if (args.length < 2) {
    return {
      success: false,
      message: 'Usage: -GivePersona Username, PersonaID\nExample: -GivePersona TestUser, 123456789101112\n\nFinds a persona by its numeric ID and copies it to the specified user.'
    }
  }
  
  // Parse arguments
  let username: string, personaIdStr: string
  
  if (args.length === 1 && args[0].includes(',')) {
    const parts = args[0].split(',').map(s => s.trim())
    username = parts[0]
    personaIdStr = parts[1] || ''
  } else {
    const allArgs = args.join(' ')
    if (allArgs.includes(',')) {
      const parts = allArgs.split(',').map(s => s.trim())
      username = parts[0]
      personaIdStr = parts[1] || ''
    } else {
      username = args[0]
      personaIdStr = args[1]
    }
  }
  
  const displayId = BigInt(personaIdStr.replace(/,/g, ''))
  
  if (!displayId) {
    return { success: false, message: 'Invalid Persona ID' }
  }
  
  try {
    // Find the target user
    const targetUser = await db.user.findUnique({
      where: { username }
    })
    
    if (!targetUser) {
      return { success: false, message: `User "${username}" not found` }
    }
    
    // Find the persona by display ID
    const originalPersona = await db.persona.findFirst({
      where: { displayId }
    })
    
    if (!originalPersona) {
      return { success: false, message: `Persona with ID "${personaIdStr}" not found` }
    }
    
    // Copy the persona to the target user
    const copiedPersona = await db.persona.create({
      data: {
        userId: targetUser.id,
        displayId: originalPersona.displayId, // Keep same display ID
        originalCreatorId: originalPersona.originalCreatorId || originalPersona.userId, // Preserve original creator
        name: originalPersona.name,
        avatarUrl: originalPersona.avatarUrl,
        description: originalPersona.description,
        archetype: originalPersona.archetype,
        gender: originalPersona.gender,
        pronouns: originalPersona.pronouns,
        age: originalPersona.age,
        tags: originalPersona.tags,
        personalityDescription: originalPersona.personalityDescription,
        personalitySpectrums: originalPersona.personalitySpectrums,
        bigFive: originalPersona.bigFive,
        hexaco: originalPersona.hexaco,
        strengths: originalPersona.strengths,
        flaws: originalPersona.flaws,
        values: originalPersona.values,
        fears: originalPersona.fears,
        species: originalPersona.species,
        likes: originalPersona.likes,
        dislikes: originalPersona.dislikes,
        hobbies: originalPersona.hobbies,
        skills: originalPersona.skills,
        languages: originalPersona.languages,
        habits: originalPersona.habits,
        speechPatterns: originalPersona.speechPatterns,
        backstory: originalPersona.backstory,
        appearance: originalPersona.appearance,
        mbtiType: originalPersona.mbtiType,
        themeEnabled: false,
        rpStyle: originalPersona.rpStyle,
        rpPreferredGenders: originalPersona.rpPreferredGenders,
        rpGenres: originalPersona.rpGenres,
        rpLimits: originalPersona.rpLimits,
        rpThemes: originalPersona.rpThemes,
        rpExperienceLevel: originalPersona.rpExperienceLevel,
        rpResponseTime: originalPersona.rpResponseTime,
        nsfwEnabled: originalPersona.nsfwEnabled,
        nsfwBodyType: originalPersona.nsfwBodyType,
        nsfwKinks: originalPersona.nsfwKinks,
        nsfwContentWarnings: originalPersona.nsfwContentWarnings,
        nsfwOrientation: originalPersona.nsfwOrientation,
        nsfwRolePreference: originalPersona.nsfwRolePreference,
        isActive: false,
        isOnline: false,
      }
    })
    
    return {
      success: true,
      message: `Successfully gave persona "${originalPersona.name}" (ID: ${personaIdStr}) to "${username}"!\n\nOriginal Creator: ${originalPersona.originalCreatorId || originalPersona.userId}\nNew Persona ID: ${copiedPersona.id}`
    }
  } catch (error) {
    console.error('GivePersona error:', error)
    return { success: false, message: 'Failed to give persona. Make sure the Persona ID is valid.' }
  }
}

// Help command
function handleHelp(): CommandResult {
  return {
    success: true,
    message: `Available Commands:

**Account Management:**
-CreateAccount Username, Password, Role
  Creates a new account with specified role
  Permissions: Staff+ (can only assign roles below own level)
  Example: -CreateAccount TestUser, password123, member

-ChangeKey Username
  Generates a new security key for the user
  Permissions: Administrator+ only
  Example: -ChangeKey TestUser

-DeleteUser Username
  Permanently deletes a user account
  Permissions: Executive only
  Example: -DeleteUser TestUser

**User Information:**
-GetUserInfo Username
  Displays detailed info about a user
  Permissions: All staff
  Example: -GetUserInfo TestUser

-SetRole Username, Role
  Changes a user's role
  Permissions: Administrator+ (can only assign roles below own level)
  Example: -SetRole TestUser, mod

**Chronos Management:**
-GiveChronos Username, Amount
  Gives (positive) or takes (negative) Chronos
  Permissions: All staff
  Example: -GiveChronos TestUser, 500
  Example: -GiveChronos TestUser, -100

**Persona Management:**
-GivePersona Username, PersonaID
  Copies a persona (by numeric ID) to a user
  Use for marketplace refunds - user gets Chronos back AND the persona
  Permissions: All staff
  Example: -GivePersona TestUser, 123456789101112

**Blorp Bot Commands:**
-BlorpDM Username, Message
  Send a custom DM from Blorp to a specific user
  Permissions: Manager+ only
  Example: -BlorpDM TestUser, This is an important announcement!

-BlorpDM All, Message
  Send a DM from Blorp to ALL users (online and offline)
  ⚠️ USE WITH CAUTION - Affects all users
  Permissions: Manager+ only
  Example: -BlorpDM All, Platform maintenance scheduled for tonight.

**Other:**
-Help
  Shows this help message

**Available Roles (in order of hierarchy):**
• Member Roles: member, notable_member, artist, verified_creator, contributor
• Moderation: intern_mod, mod, senior_mod, head_mod
• Administration: admin, head_staff, assistant_manager, manager
• Executive: executive_chairman, owner

**Permission Levels:**
• Intern Mod+: View info, give Chronos, give personas
• Administrator+: Create accounts, change keys, set roles
• Manager+: BlorpDM commands
• Executive: Delete users, full access`
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication and staff status
    const currentUser = await getSessionWithFreshRoleFromRequest(request)
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const userRole = currentUser.role
    
    // Check if user is staff (can access command terminal)
    if (!isStaff(userRole)) {
      return NextResponse.json({ error: 'Staff access required' }, { status: 403 })
    }
    
    // Parse request body
    const body = await request.json()
    const { command } = body
    
    if (!command || typeof command !== 'string') {
      return NextResponse.json({ 
        success: false, 
        message: 'Command is required' 
      })
    }
    
    // Parse the command
    const parsed = parseCommand(command)
    
    if (!parsed) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid command format. Commands must start with "-" (e.g., -Help)' 
      })
    }
    
    const { command: cmd, args } = parsed
    
    // Get actor ID for logging
    const actorId = currentUser.id
    
    let result: CommandResult
    
    switch (cmd) {
      case '-createaccount':
      case 'createaccount':
        result = await handleCreateAccount(args, userRole)
        break
        
      case '-changekey':
      case 'changekey':
        result = await handleChangeKey(args, userRole)
        break
        
      case '-getuserinfo':
      case 'getuserinfo':
        result = await handleGetUserInfo(args)
        break
        
      case '-deleteuser':
      case 'deleteuser':
        result = await handleDeleteUser(args, userRole)
        break
        
      case '-setrole':
      case 'setrole':
        result = await handleSetRole(args, userRole)
        break
        
      case '-givechronos':
      case 'givechronos':
        result = await handleGiveChronos(args)
        break
        
      case '-givepersona':
      case 'givepersona':
        result = await handleGivePersona(args)
        break
      
      // ====== NEW MODERATION COMMANDS ======
      case '-warn':
      case 'warn':
        result = await handleWarn(args, userRole, actorId)
        break
        
      case '-mute':
      case 'mute':
        result = await handleMute(args, userRole, actorId)
        break
        
      case '-unmute':
      case 'unmute':
        result = await handleUnmute(args, userRole, actorId)
        break
        
      case '-clearwarnings':
      case 'clearwarnings':
        result = await handleClearWarnings(args, userRole, actorId)
        break
        
      case '-freeze':
      case 'freeze':
        result = await handleFreeze(args, userRole, actorId)
        break
        
      case '-unfreeze':
      case 'unfreeze':
        result = await handleUnfreeze(args, userRole, actorId)
        break
        
      case '-suspend':
      case 'suspend':
        result = await handleSuspend(args, userRole, actorId)
        break
        
      case '-unsuspend':
      case 'unsuspend':
        result = await handleUnsuspend(args, userRole, actorId)
        break
        
      case '-ban':
      case 'ban':
        result = await handleBan(args, userRole, actorId)
        break
        
      case '-unban':
      case 'unban':
        result = await handleUnban(args, userRole, actorId)
        break
        
      case '-terminate':
      case 'terminate':
        result = await handleTerminate(args, userRole, actorId)
        break
        
      case '-viewhistory':
      case 'viewhistory':
        result = await handleViewHistory(args, userRole)
        break
        
      case '-kick':
      case 'kick':
        result = await handleKick(args, userRole, actorId)
        break
        
      case '-modnote':
      case 'modnote':
        result = await handleModNote(args, userRole, actorId)
        break
        
      case '-blorpdm':
      case 'blorpdm':
        result = await handleBlorpDM(args, userRole)
        break
        
      case '-help':
      case 'help':
        result = handleHelp()
        break
        
      default:
        result = {
          success: false,
          message: `Unknown command: ${cmd}\nType -Help for available commands`
        }
    }
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('Admin command error:', error)
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 })
  }
}
