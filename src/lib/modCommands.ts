import { db } from '@/lib/db'
import { getRoleLevel, getRoleLabel, isStaff, isModerator, isAdmin, isExecutive } from '@/lib/roles'
import { sendBlorpMessage, ensureBlorpExists, sendCustomBlorpMessage, sendBlorpMessageToAll } from '@/lib/blorp'

// ==================== Role Level Constants ====================
export const ROLE_LEVELS = {
  Intern: 10,
  Mod: 11,
  SeniorMod: 12,
  HeadMod: 13,
  Admin: 20,
  HeadStaff: 21,
  AssistantManager: 22,
  Manager: 23,
  ExecutiveChairman: 30,
  Owner: 31,
} as const

// ==================== Permission Helper ====================
function hasMinPermission(userRole: string, requiredLevel: number): boolean {
  const userLevel = getRoleLevel(userRole)
  return userLevel >= requiredLevel
}

// Get required role label for error messages
function getRequiredRoleLabel(level: number): string {
  if (level >= ROLE_LEVELS.Owner) return 'Owner'
  if (level >= ROLE_LEVELS.ExecutiveChairman) return 'Executive Chairman'
  if (level >= ROLE_LEVELS.Manager) return 'Manager'
  if (level >= ROLE_LEVELS.AssistantManager) return 'Assistant Manager'
  if (level >= ROLE_LEVELS.HeadStaff) return 'Head of Staff'
  if (level >= ROLE_LEVELS.Admin) return 'Administrator'
  if (level >= ROLE_LEVELS.HeadMod) return 'Head Moderator'
  if (level >= ROLE_LEVELS.SeniorMod) return 'Senior Moderator'
  if (level >= ROLE_LEVELS.Mod) return 'Moderator'
  if (level >= ROLE_LEVELS.Intern) return 'Intern Moderator'
  return 'Staff'
}

// ==================== Command Result Type ====================
export interface CommandResult {
  success: boolean
  message: string
  data?: Record<string, unknown>
}

// ==================== PARSE DURATION HELPER ====================
function parseDuration(durationStr: string): { ms: number; display: string } | null {
  const match = durationStr.match(/^(\d+)([hdwm]?)$/i)
  if (!match) return null
  
  const amount = parseInt(match[1])
  const unit = match[2].toLowerCase() || 'h'
  
  let ms = 0
  let display = ''
  
  switch (unit) {
    case 'm':
      ms = amount * 60 * 1000
      display = `${amount} minute${amount > 1 ? 's' : ''}`
      break
    case 'h':
      ms = amount * 60 * 60 * 1000
      display = `${amount} hour${amount > 1 ? 's' : ''}`
      break
    case 'd':
      ms = amount * 24 * 60 * 60 * 1000
      display = `${amount} day${amount > 1 ? 's' : ''}`
      break
    case 'w':
      ms = amount * 7 * 24 * 60 * 60 * 1000
      display = `${amount} week${amount > 1 ? 's' : ''}`
      break
    default:
      return null
  }
  
  return { ms, display }
}

// ==================== MODERATION COMMAND HANDLERS ====================

// Warn command: -Warn Username, Reason
export async function handleWarn(args: string[], userRole: string, actorId: string): Promise<CommandResult> {
  if (!hasMinPermission(userRole, ROLE_LEVELS.Intern)) {
    return { success: false, message: `You do not have permission to use this command (Requires ${getRequiredRoleLabel(ROLE_LEVELS.Intern)}+)` }
  }
  
  if (args.length < 1) {
    return { success: false, message: 'Usage: -Warn Username, Reason\nExample: -Warn TestUser, Spamming in chat' }
  }
  
  const parts = args.join(' ').split(',').map(s => s.trim())
  const username = parts[0]
  const reason = parts.slice(1).join(', ').trim() || 'No reason provided'
  
  if (!username) {
    return { success: false, message: 'Username is required' }
  }
  
  try {
    const targetUser = await db.user.findUnique({ where: { username } })
    if (!targetUser) {
      return { success: false, message: `User "${username}" not found` }
    }
    
    const newWarningCount = targetUser.warningCount + 1
    
    await db.user.update({
      where: { id: targetUser.id },
      data: { warningCount: newWarningCount }
    })
    
    await db.adminLog.create({
      data: {
        adminId: actorId,
        action: 'warn',
        targetType: 'user',
        targetId: targetUser.id,
        details: JSON.stringify({ reason, warningCount: newWarningCount })
      }
    })
    
    // Notify user via Blorp
    ensureBlorpExists().then(() => {
      sendBlorpMessage(targetUser.id, {
        type: 'chronos_deducted',
        amount: 0,
        reason: `You have received a warning: ${reason}\n\nTotal warnings: ${newWarningCount}`
      }).catch(() => {})
    })
    
    return {
      success: true,
      message: `Warning issued to "${username}"!\nReason: ${reason}\nTotal warnings: ${newWarningCount}`
    }
  } catch (error) {
    console.error('Warn error:', error)
    return { success: false, message: 'Failed to issue warning' }
  }
}

// Mute command: -Mute Username, Duration, Reason
export async function handleMute(args: string[], userRole: string, actorId: string): Promise<CommandResult> {
  if (!hasMinPermission(userRole, ROLE_LEVELS.Mod)) {
    return { success: false, message: `You do not have permission to use this command (Requires ${getRequiredRoleLabel(ROLE_LEVELS.Mod)}+)` }
  }
  
  if (args.length < 2) {
    return { success: false, message: 'Usage: -Mute Username, Duration, Reason\nExample: -Mute TestUser, 1h, Spamming in chat\nDuration formats: 30m, 1h, 1d, 1w' }
  }
  
  const parts = args.join(' ').split(',').map(s => s.trim())
  const username = parts[0]
  const durationStr = parts[1] || ''
  const reason = parts.slice(2).join(', ').trim() || 'No reason provided'
  
  if (!username) {
    return { success: false, message: 'Username is required' }
  }
  
  const duration = parseDuration(durationStr)
  if (!duration) {
    return { success: false, message: 'Invalid duration format. Use: 30m, 1h, 1d, 1w' }
  }
  
  try {
    const targetUser = await db.user.findUnique({ where: { username } })
    if (!targetUser) {
      return { success: false, message: `User "${username}" not found` }
    }
    
    const mutedUntil = new Date(Date.now() + duration.ms)
    
    await db.user.update({
      where: { id: targetUser.id },
      data: { isMuted: true, mutedUntil }
    })
    
    await db.adminLog.create({
      data: {
        adminId: actorId,
        action: 'mute',
        targetType: 'user',
        targetId: targetUser.id,
        details: JSON.stringify({ reason, duration: duration.display, mutedUntil })
      }
    })
    
    return {
      success: true,
      message: `User "${username}" has been muted for ${duration.display}.\nReason: ${reason}\nMuted until: ${mutedUntil.toLocaleString()}`
    }
  } catch (error) {
    console.error('Mute error:', error)
    return { success: false, message: 'Failed to mute user' }
  }
}

// Unmute command: -Unmute Username
export async function handleUnmute(args: string[], userRole: string, actorId: string): Promise<CommandResult> {
  if (!hasMinPermission(userRole, ROLE_LEVELS.Mod)) {
    return { success: false, message: `You do not have permission to use this command (Requires ${getRequiredRoleLabel(ROLE_LEVELS.Mod)}+)` }
  }
  
  if (args.length < 1) {
    return { success: false, message: 'Usage: -Unmute Username\nExample: -Unmute TestUser' }
  }
  
  const username = args[0].replace(/,/g, '').trim()
  
  try {
    const targetUser = await db.user.findUnique({ where: { username } })
    if (!targetUser) {
      return { success: false, message: `User "${username}" not found` }
    }
    
    if (!targetUser.isMuted) {
      return { success: false, message: `User "${username}" is not muted.` }
    }
    
    await db.user.update({
      where: { id: targetUser.id },
      data: { isMuted: false, mutedUntil: null }
    })
    
    await db.adminLog.create({
      data: {
        adminId: actorId,
        action: 'unmute',
        targetType: 'user',
        targetId: targetUser.id,
        details: JSON.stringify({ unmutedBy: getRoleLabel(userRole) })
      }
    })
    
    return { success: true, message: `User "${username}" has been unmuted.` }
  } catch (error) {
    console.error('Unmute error:', error)
    return { success: false, message: 'Failed to unmute user' }
  }
}

// ClearWarnings command: -ClearWarnings Username
export async function handleClearWarnings(args: string[], userRole: string, actorId: string): Promise<CommandResult> {
  if (!hasMinPermission(userRole, ROLE_LEVELS.SeniorMod)) {
    return { success: false, message: `You do not have permission to use this command (Requires ${getRequiredRoleLabel(ROLE_LEVELS.SeniorMod)}+)` }
  }
  
  if (args.length < 1) {
    return { success: false, message: 'Usage: -ClearWarnings Username\nExample: -ClearWarnings TestUser' }
  }
  
  const username = args[0].replace(/,/g, '').trim()
  
  try {
    const targetUser = await db.user.findUnique({ where: { username } })
    if (!targetUser) {
      return { success: false, message: `User "${username}" not found` }
    }
    
    await db.user.update({
      where: { id: targetUser.id },
      data: { warningCount: 0 }
    })
    
    await db.adminLog.create({
      data: {
        adminId: actorId,
        action: 'clear_warnings',
        targetType: 'user',
        targetId: targetUser.id,
        details: JSON.stringify({ previousCount: targetUser.warningCount })
      }
    })
    
    return { success: true, message: `All warnings cleared for "${username}". Previous count: ${targetUser.warningCount}` }
  } catch (error) {
    console.error('ClearWarnings error:', error)
    return { success: false, message: 'Failed to clear warnings' }
  }
}

// Freeze command: -Freeze Username, Reason
export async function handleFreeze(args: string[], userRole: string, actorId: string): Promise<CommandResult> {
  if (!hasMinPermission(userRole, ROLE_LEVELS.HeadMod)) {
    return { success: false, message: `You do not have permission to use this command (Requires ${getRequiredRoleLabel(ROLE_LEVELS.HeadMod)}+)` }
  }
  
  if (args.length < 1) {
    return { success: false, message: 'Usage: -Freeze Username, Reason\nExample: -Freeze TestUser, Suspected bot account' }
  }
  
  const parts = args.join(' ').split(',').map(s => s.trim())
  const username = parts[0]
  const reason = parts.slice(1).join(', ').trim() || 'No reason provided'
  
  try {
    const targetUser = await db.user.findUnique({ where: { username } })
    if (!targetUser) {
      return { success: false, message: `User "${username}" not found` }
    }
    
    const actorLevel = getRoleLevel(userRole)
    const targetLevel = getRoleLevel(targetUser.role)
    
    if (actorLevel <= targetLevel) {
      return { success: false, message: 'Cannot freeze users with equal or higher role than yourself' }
    }
    
    await db.user.update({
      where: { id: targetUser.id },
      data: { isFrozen: true }
    })
    
    await db.adminLog.create({
      data: {
        adminId: actorId,
        action: 'freeze',
        targetType: 'user',
        targetId: targetUser.id,
        details: JSON.stringify({ reason })
      }
    })
    
    return { success: true, message: `User "${username}" has been frozen.\nReason: ${reason}\n\nThe user cannot login, chat, or create personas until unfrozen.` }
  } catch (error) {
    console.error('Freeze error:', error)
    return { success: false, message: 'Failed to freeze user' }
  }
}

// Unfreeze command: -Unfreeze Username
export async function handleUnfreeze(args: string[], userRole: string, actorId: string): Promise<CommandResult> {
  if (!hasMinPermission(userRole, ROLE_LEVELS.HeadMod)) {
    return { success: false, message: `You do not have permission to use this command (Requires ${getRequiredRoleLabel(ROLE_LEVELS.HeadMod)}+)` }
  }
  
  if (args.length < 1) {
    return { success: false, message: 'Usage: -Unfreeze Username\nExample: -Unfreeze TestUser' }
  }
  
  const username = args[0].replace(/,/g, '').trim()
  
  try {
    const targetUser = await db.user.findUnique({ where: { username } })
    if (!targetUser) {
      return { success: false, message: `User "${username}" not found` }
    }
    
    if (!targetUser.isFrozen) {
      return { success: false, message: `User "${username}" is not frozen.` }
    }
    
    await db.user.update({
      where: { id: targetUser.id },
      data: { isFrozen: false }
    })
    
    await db.adminLog.create({
      data: {
        adminId: actorId,
        action: 'unfreeze',
        targetType: 'user',
        targetId: targetUser.id,
        details: JSON.stringify({ unfrozenBy: getRoleLabel(userRole) })
      }
    })
    
    return { success: true, message: `User "${username}" has been unfrozen.` }
  } catch (error) {
    console.error('Unfreeze error:', error)
    return { success: false, message: 'Failed to unfreeze user' }
  }
}

// Suspend command: -Suspend Username, Duration, Reason
export async function handleSuspend(args: string[], userRole: string, actorId: string): Promise<CommandResult> {
  if (!hasMinPermission(userRole, ROLE_LEVELS.Admin)) {
    return { success: false, message: `You do not have permission to use this command (Requires ${getRequiredRoleLabel(ROLE_LEVELS.Admin)}+)` }
  }
  
  if (args.length < 2) {
    return { success: false, message: 'Usage: -Suspend Username, Duration, Reason\nExample: -Suspend TestUser, 7d, Repeated violations\nDuration formats: 30m, 1h, 1d, 1w' }
  }
  
  const parts = args.join(' ').split(',').map(s => s.trim())
  const username = parts[0]
  const durationStr = parts[1] || ''
  const reason = parts.slice(2).join(', ').trim() || 'No reason provided'
  
  if (!username) {
    return { success: false, message: 'Username is required' }
  }
  
  const duration = parseDuration(durationStr)
  if (!duration) {
    return { success: false, message: 'Invalid duration format. Use: 30m, 1h, 1d, 1w' }
  }
  
  try {
    const targetUser = await db.user.findUnique({ where: { username } })
    if (!targetUser) {
      return { success: false, message: `User "${username}" not found` }
    }
    
    const actorLevel = getRoleLevel(userRole)
    const targetLevel = getRoleLevel(targetUser.role)
    
    if (actorLevel <= targetLevel) {
      return { success: false, message: 'Cannot suspend users with equal or higher role than yourself' }
    }
    
    const suspendedUntil = new Date(Date.now() + duration.ms)
    
    await db.user.update({
      where: { id: targetUser.id },
      data: { isSuspended: true, suspendedUntil, suspendReason: reason }
    })
    
    await db.adminLog.create({
      data: {
        adminId: actorId,
        action: 'suspend',
        targetType: 'user',
        targetId: targetUser.id,
        details: JSON.stringify({ reason, duration: duration.display, suspendedUntil })
      }
    })
    
    return {
      success: true,
      message: `User "${username}" has been suspended for ${duration.display}.\nReason: ${reason}\nSuspended until: ${suspendedUntil.toLocaleString()}`
    }
  } catch (error) {
    console.error('Suspend error:', error)
    return { success: false, message: 'Failed to suspend user' }
  }
}

// Unsuspend command: -Unsuspend Username
export async function handleUnsuspend(args: string[], userRole: string, actorId: string): Promise<CommandResult> {
  if (!hasMinPermission(userRole, ROLE_LEVELS.Admin)) {
    return { success: false, message: `You do not have permission to use this command (Requires ${getRequiredRoleLabel(ROLE_LEVELS.Admin)}+)` }
  }
  
  if (args.length < 1) {
    return { success: false, message: 'Usage: -Unsuspend Username\nExample: -Unsuspend TestUser' }
  }
  
  const username = args[0].replace(/,/g, '').trim()
  
  try {
    const targetUser = await db.user.findUnique({ where: { username } })
    if (!targetUser) {
      return { success: false, message: `User "${username}" not found` }
    }
    
    if (!targetUser.isSuspended) {
      return { success: false, message: `User "${username}" is not suspended.` }
    }
    
    await db.user.update({
      where: { id: targetUser.id },
      data: { isSuspended: false, suspendedUntil: null, suspendReason: null }
    })
    
    await db.adminLog.create({
      data: {
        adminId: actorId,
        action: 'unsuspend',
        targetType: 'user',
        targetId: targetUser.id,
        details: JSON.stringify({ unsuspendedBy: getRoleLabel(userRole) })
      }
    })
    
    return { success: true, message: `User "${username}" has been unsuspended.` }
  } catch (error) {
    console.error('Unsuspend error:', error)
    return { success: false, message: 'Failed to unsuspend user' }
  }
}

// Ban command: -Ban Username, Reason
export async function handleBan(args: string[], userRole: string, actorId: string): Promise<CommandResult> {
  if (!hasMinPermission(userRole, ROLE_LEVELS.Admin)) {
    return { success: false, message: `You do not have permission to use this command (Requires ${getRequiredRoleLabel(ROLE_LEVELS.Admin)}+)` }
  }
  
  if (args.length < 1) {
    return { success: false, message: 'Usage: -Ban Username, Reason\nExample: -Ban TestUser, Severe violation of terms' }
  }
  
  const parts = args.join(' ').split(',').map(s => s.trim())
  const username = parts[0]
  const reason = parts.slice(1).join(', ').trim() || 'No reason provided'
  
  try {
    const targetUser = await db.user.findUnique({ where: { username } })
    if (!targetUser) {
      return { success: false, message: `User "${username}" not found` }
    }
    
    const actorLevel = getRoleLevel(userRole)
    const targetLevel = getRoleLevel(targetUser.role)
    
    if (actorLevel <= targetLevel) {
      return { success: false, message: 'Cannot ban users with equal or higher role than yourself' }
    }
    
    await db.user.update({
      where: { id: targetUser.id },
      data: { isBanned: true, banReason: reason }
    })
    
    await db.adminLog.create({
      data: {
        adminId: actorId,
        action: 'ban',
        targetType: 'user',
        targetId: targetUser.id,
        details: JSON.stringify({ reason })
      }
    })
    
    return { success: true, message: `User "${username}" has been permanently banned.\nReason: ${reason}` }
  } catch (error) {
    console.error('Ban error:', error)
    return { success: false, message: 'Failed to ban user' }
  }
}

// Unban command: -Unban Username
export async function handleUnban(args: string[], userRole: string, actorId: string): Promise<CommandResult> {
  if (!hasMinPermission(userRole, ROLE_LEVELS.Admin)) {
    return { success: false, message: `You do not have permission to use this command (Requires ${getRequiredRoleLabel(ROLE_LEVELS.Admin)}+)` }
  }
  
  if (args.length < 1) {
    return { success: false, message: 'Usage: -Unban Username\nExample: -Unban TestUser' }
  }
  
  const username = args[0].replace(/,/g, '').trim()
  
  try {
    const targetUser = await db.user.findUnique({ where: { username } })
    if (!targetUser) {
      return { success: false, message: `User "${username}" not found` }
    }
    
    if (!targetUser.isBanned) {
      return { success: false, message: `User "${username}" is not banned.` }
    }
    
    await db.user.update({
      where: { id: targetUser.id },
      data: { isBanned: false, banReason: null }
    })
    
    await db.adminLog.create({
      data: {
        adminId: actorId,
        action: 'unban',
        targetType: 'user',
        targetId: targetUser.id,
        details: JSON.stringify({ unbannedBy: getRoleLabel(userRole) })
      }
    })
    
    return { success: true, message: `User "${username}" has been unbanned.` }
  } catch (error) {
    console.error('Unban error:', error)
    return { success: false, message: 'Failed to unban user' }
  }
}

// Terminate command: -Terminate Username (Executive only - permanent account deletion)
export async function handleTerminate(args: string[], userRole: string, actorId: string): Promise<CommandResult> {
  if (!hasMinPermission(userRole, ROLE_LEVELS.Manager)) {
    return { success: false, message: `You do not have permission to use this command (Requires ${getRequiredRoleLabel(ROLE_LEVELS.Manager)}+)` }
  }
  
  if (args.length < 1) {
    return { success: false, message: 'Usage: -Terminate Username\nExample: -Terminate TestUser\n\n⚠️ WARNING: This permanently deletes the user account and all associated data.' }
  }
  
  const username = args[0].replace(/,/g, '').trim()
  
  try {
    const targetUser = await db.user.findUnique({
      where: { username },
      include: {
        _count: {
          select: { personas: true, storylineMembers: true }
        }
      }
    })
    
    if (!targetUser) {
      return { success: false, message: `User "${username}" not found` }
    }
    
    const actorLevel = getRoleLevel(userRole)
    const targetLevel = getRoleLevel(targetUser.role)
    
    if (actorLevel <= targetLevel) {
      return { success: false, message: 'Cannot terminate users with equal or higher role than yourself' }
    }
    
    // Log before deletion
    await db.adminLog.create({
      data: {
        adminId: actorId,
        action: 'terminate',
        targetType: 'user',
        targetId: targetUser.id,
        details: JSON.stringify({ 
          username: targetUser.username,
          personasDeleted: targetUser._count.personas,
          storylineMembershipsRemoved: targetUser._count.storylineMembers
        })
      }
    })
    
    // Delete user (cascade will handle related data)
    await db.user.delete({ where: { id: targetUser.id } })
    
    return {
      success: true,
      message: `User "${username}" has been permanently terminated.\nPersonas deleted: ${targetUser._count.personas}\nStoryline memberships removed: ${targetUser._count.storylineMembers}\n\n⚠️ This action cannot be undone.`
    }
  } catch (error) {
    console.error('Terminate error:', error)
    return { success: false, message: 'Failed to terminate user' }
  }
}

// ViewHistory command: -ViewHistory Username
export async function handleViewHistory(args: string[], userRole: string): Promise<CommandResult> {
  if (!hasMinPermission(userRole, ROLE_LEVELS.Intern)) {
    return { success: false, message: `You do not have permission to use this command (Requires ${getRequiredRoleLabel(ROLE_LEVELS.Intern)}+)` }
  }
  
  if (args.length < 1) {
    return { success: false, message: 'Usage: -ViewHistory Username\nExample: -ViewHistory TestUser' }
  }
  
  const username = args[0].replace(/,/g, '').trim()
  
  try {
    const targetUser = await db.user.findUnique({
      where: { username },
      include: {
        moderationActionsReceived: {
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    })
    
    if (!targetUser) {
      return { success: false, message: `User "${username}" not found` }
    }
    
    const logs = await db.adminLog.findMany({
      where: { targetId: targetUser.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    })
    
    if (logs.length === 0) {
      return { success: true, message: `No moderation history found for "${username}".` }
    }
    
    const historyLines = logs.map(log => {
      const date = new Date(log.createdAt).toLocaleDateString()
      return `[${date}] ${log.action}${log.details ? ` - ${log.details}` : ''}`
    })
    
    return {
      success: true,
      message: `Moderation history for "${username}":\n\n${historyLines.join('\n')}\n\nCurrent Status:\n• Warnings: ${targetUser.warningCount}\n• Muted: ${targetUser.isMuted ? 'Yes' : 'No'}\n• Frozen: ${targetUser.isFrozen ? 'Yes' : 'No'}\n• Suspended: ${targetUser.isSuspended ? 'Yes' : 'No'}\n• Banned: ${targetUser.isBanned ? 'Yes' : 'No'}`
    }
  } catch (error) {
    console.error('ViewHistory error:', error)
    return { success: false, message: 'Failed to view history' }
  }
}

// Kick command: -Kick Username, StorylineId, Reason
export async function handleKick(args: string[], userRole: string, actorId: string): Promise<CommandResult> {
  if (!hasMinPermission(userRole, ROLE_LEVELS.SeniorMod)) {
    return { success: false, message: `You do not have permission to use this command (Requires ${getRequiredRoleLabel(ROLE_LEVELS.SeniorMod)}+)` }
  }
  
  if (args.length < 2) {
    return { success: false, message: 'Usage: -Kick Username, StorylineId, Reason\nExample: -Kick TestUser, storyline123, Spamming' }
  }
  
  const parts = args.join(' ').split(',').map(s => s.trim())
  const username = parts[0]
  const storylineId = parts[1]
  const reason = parts.slice(2).join(', ').trim() || 'No reason provided'
  
  if (!username || !storylineId) {
    return { success: false, message: 'Username and StorylineId are required' }
  }
  
  try {
    const targetUser = await db.user.findUnique({ where: { username } })
    if (!targetUser) {
      return { success: false, message: `User "${username}" not found` }
    }
    
    const member = await db.storylineMember.findFirst({
      where: { storylineId, userId: targetUser.id }
    })
    
    if (!member) {
      return { success: false, message: `User "${username}" is not a member of storyline "${storylineId}"` }
    }
    
    const actorLevel = getRoleLevel(userRole)
    const targetLevel = getRoleLevel(targetUser.role)
    
    if (actorLevel <= targetLevel) {
      return { success: false, message: 'Cannot kick users with equal or higher role than yourself' }
    }
    
    await db.storylineMember.delete({ where: { id: member.id } })
    
    await db.adminLog.create({
      data: {
        adminId: actorId,
        action: 'kick_from_storyline',
        targetType: 'storyline',
        targetId: targetUser.id,
        details: JSON.stringify({ storylineId, reason })
      }
    })
    
    return { success: true, message: `User "${username}" has been kicked from storyline "${storylineId}".\nReason: ${reason}` }
  } catch (error) {
    console.error('Kick error:', error)
    return { success: false, message: 'Failed to kick user from storyline' }
  }
}

// ModNote command: -ModNote Username, Note
export async function handleModNote(args: string[], userRole: string, actorId: string): Promise<CommandResult> {
  if (!hasMinPermission(userRole, ROLE_LEVELS.SeniorMod)) {
    return { success: false, message: `You do not have permission to use this command (Requires ${getRequiredRoleLabel(ROLE_LEVELS.SeniorMod)}+)` }
  }
  
  if (args.length < 2) {
    return { success: false, message: 'Usage: -ModNote Username, Note\nExample: -ModNote TestUser, Suspicious activity observed' }
  }
  
  const parts = args.join(' ').split(',').map(s => s.trim())
  const username = parts[0]
  const note = parts.slice(1).join(', ').trim()
  
  if (!username || !note) {
    return { success: false, message: 'Username and note are required' }
  }
  
  try {
    const targetUser = await db.user.findUnique({ where: { username } })
    if (!targetUser) {
      return { success: false, message: `User "${username}" not found` }
    }
    
    await db.adminLog.create({
      data: {
        adminId: actorId,
        action: 'mod_note',
        targetType: 'user',
        targetId: targetUser.id,
        details: JSON.stringify({ note, addedBy: getRoleLabel(userRole) })
      }
    })
    
    return { success: true, message: `Mod note added to "${username}"'s profile.\nNote: ${note}` }
  } catch (error) {
    console.error('ModNote error:', error)
    return { success: false, message: 'Failed to add mod note' }
  }
}

// Help command for moderation
export function handleModHelp(): CommandResult {
  return {
    success: true,
    message: `**=== MODERATION COMMANDS ===**

**Intern Moderator+**
-Warn Username, Reason
  Issue a warning to a user
  Example: -Warn TestUser, Spamming in chat

-ViewHistory Username
  View moderation history for a user
  Example: -ViewHistory TestUser

-GetUserInfo Username
  View detailed user information
  Example: -GetUserInfo TestUser

**Moderator+**
-Mute Username, Duration, Reason
  Mute a user temporarily (duration: 30m, 1h, 1d, 1w)
  Example: -Mute TestUser, 1h, Spamming in chat

-Unmute Username
  Remove mute from a user
  Example: -Unmute TestUser

-GiveChronos Username, Amount
  Give or deduct Chronos (negative to deduct)
  Example: -GiveChronos TestUser, 500

**Senior Moderator+**
-ClearWarnings Username
  Clear all warnings for a user
  Example: -ClearWarnings TestUser

-Kick Username, StorylineId, Reason
  Kick user from a storyline
  Example: -Kick TestUser, storyline123, Spamming

-ModNote Username, Note
  Add a moderation note to user's profile
  Example: -ModNote TestUser, Suspicious activity

**Head Moderator+**
-Freeze Username, Reason
  Freeze an account (no login, chat, or actions)
  Example: -Freeze TestUser, Suspected bot

-Unfreeze Username
  Unfreeze a frozen account
  Example: -Unfreeze TestUser

**Administrator+**
-Suspend Username, Duration, Reason
  Suspend an account temporarily
  Example: -Suspend TestUser, 7d, Repeated violations

-Unsuspend Username
  Remove suspension from a user
  Example: -Unsuspend TestUser

-Ban Username, Reason
  Permanently ban a user
  Example: -Ban TestUser, Severe violation

-Unban Username
  Remove ban from a user
  Example: -Unban TestUser

**Manager+ (Executive)**
-Terminate Username
  Permanently delete user account and all data
  ⚠️ IRREVERSIBLE ACTION
  Example: -Terminate TestUser

-BlorpDM Username, Message
  Send a custom DM from Blorp to a specific user
  Example: -BlorpDM TestUser, This is an important announcement!

-BlorpDM All, Message
  Send a DM from Blorp to ALL users (online and offline)
  ⚠️ USE WITH CAUTION - Affects all users
  Example: -BlorpDM All, Platform maintenance scheduled for tonight.

**=== ROLE HIERARCHY ===**
• Intern Mod (10) → Mod (11) → Senior Mod (12) → Head Mod (13)
• Admin (20) → Head Staff (21) → Assistant Manager (22) → Manager (23)
• Executive Chairman (30) → Owner (31)

**Note:** You cannot perform actions on users with equal or higher role than yourself.`
  }
}

// BlorpDM command: -BlorpDM [Username|All], Message
export async function handleBlorpDM(args: string[], userRole: string): Promise<CommandResult> {
  // Only Manager+ can use this command
  if (!hasMinPermission(userRole, ROLE_LEVELS.Manager)) {
    return { success: false, message: `You do not have permission to use this command (Requires ${getRequiredRoleLabel(ROLE_LEVELS.Manager)}+)` }
  }
  
  if (args.length < 2) {
    return { 
      success: false, 
      message: 'Usage: -BlorpDM [Username|All], Message\n' +
        'Example: -BlorpDM TestUser, This is an important notification!\n' +
        'Example: -BlorpDM All, Platform maintenance scheduled for tonight.\n\n' +
        '⚠️ Note: "All" sends to ALL users (online and offline). Use with caution!'
    }
  }
  
  const parts = args.join(' ').split(',').map(s => s.trim())
  const target = parts[0]?.toLowerCase()
  const message = parts.slice(1).join(',').trim()
  
  if (!target || !message) {
    return { success: false, message: 'Target (username or "All") and message are required' }
  }
  
  try {
    // Ensure Blorp exists
    await ensureBlorpExists()
    
    // Send to all users
    if (target === 'all') {
      const result = await sendBlorpMessageToAll(message)
      
      if (result.success) {
        return {
          success: true,
          message: `✅ Blorp DM sent to all users!\n\nSent: ${result.sentCount}\nFailed: ${result.failedCount}\n\nMessage:\n${message.substring(0, 200)}${message.length > 200 ? '...' : ''}`
        }
      } else {
        return {
          success: false,
          message: `Failed to send to all users. Sent: ${result.sentCount}, Failed: ${result.failedCount}\nErrors: ${result.errors.slice(0, 5).join(', ')}`
        }
      }
    }
    
    // Send to specific user
    const targetUser = await db.user.findUnique({
      where: { username: target }
    })
    
    if (!targetUser) {
      return { success: false, message: `User "${target}" not found` }
    }
    
    const result = await sendCustomBlorpMessage(targetUser.id, message)
    
    if (result.success) {
      return {
        success: true,
        message: `✅ Blorp DM sent to "${targetUser.username}"!\n\nMessage:\n${message.substring(0, 300)}${message.length > 300 ? '...' : ''}`
      }
    } else {
      return { success: false, message: `Failed to send DM: ${result.error}` }
    }
  } catch (error) {
    console.error('BlorpDM error:', error)
    return { success: false, message: 'Failed to send Blorp DM' }
  }
}
