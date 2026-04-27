// ==================== ROLE SYSTEM ====================
// Complete role hierarchy for ChronaProject

// Role categories
export const ROLE_CATEGORIES = {
  MEMBER: 'member',
  MODERATION: 'moderation',
  ADMINISTRATION: 'administration',
  EXECUTIVE: 'executive'
} as const

// All available roles in hierarchy order (lowest to highest within each category)
export const ROLES = {
  // === MEMBER ROLES (No admin panel access) ===
  member: {
    id: 'member',
    label: 'Member',
    color: 'text-gray-400 bg-gray-500/20',
    category: ROLE_CATEGORIES.MEMBER,
    level: 0,
    canAccessAdminPanel: false,
  },
  notable_member: {
    id: 'notable_member',
    label: 'Notable Member',
    color: 'text-emerald-400 bg-emerald-500/20',
    category: ROLE_CATEGORIES.MEMBER,
    level: 1,
    canAccessAdminPanel: false,
  },
  artist: {
    id: 'artist',
    label: 'Artist',
    color: 'text-pink-400 bg-pink-500/20',
    category: ROLE_CATEGORIES.MEMBER,
    level: 2,
    canAccessAdminPanel: false,
  },
  verified_creator: {
    id: 'verified_creator',
    label: 'Verified Creator',
    color: 'text-cyan-400 bg-cyan-500/20',
    category: ROLE_CATEGORIES.MEMBER,
    level: 3,
    canAccessAdminPanel: false,
  },
  contributor: {
    id: 'contributor',
    label: 'Contributor',
    color: 'text-orange-400 bg-orange-500/20',
    category: ROLE_CATEGORIES.MEMBER,
    level: 4,
    canAccessAdminPanel: false,
  },
  
  // === MODERATION TEAM ===
  intern_mod: {
    id: 'intern_mod',
    label: 'Intern Moderator',
    color: 'text-indigo-400 bg-indigo-500/20',
    category: ROLE_CATEGORIES.MODERATION,
    level: 10,
    canAccessAdminPanel: true,
  },
  mod: {
    id: 'mod',
    label: 'Moderator',
    color: 'text-purple-400 bg-purple-500/20',
    category: ROLE_CATEGORIES.MODERATION,
    level: 11,
    canAccessAdminPanel: true,
  },
  senior_mod: {
    id: 'senior_mod',
    label: 'Senior Moderator',
    color: 'text-violet-400 bg-violet-500/20',
    category: ROLE_CATEGORIES.MODERATION,
    level: 12,
    canAccessAdminPanel: true,
  },
  head_mod: {
    id: 'head_mod',
    label: 'Head Moderator',
    color: 'text-fuchsia-400 bg-fuchsia-500/20',
    category: ROLE_CATEGORIES.MODERATION,
    level: 13,
    canAccessAdminPanel: true,
  },
  
  // === ADMINISTRATION ===
  admin: {
    id: 'admin',
    label: 'Administrator',
    color: 'text-rose-400 bg-rose-500/20',
    category: ROLE_CATEGORIES.ADMINISTRATION,
    level: 20,
    canAccessAdminPanel: true,
  },
  head_staff: {
    id: 'head_staff',
    label: 'Head of Staff',
    color: 'text-red-400 bg-red-500/20',
    category: ROLE_CATEGORIES.ADMINISTRATION,
    level: 21,
    canAccessAdminPanel: true,
  },
  assistant_manager: {
    id: 'assistant_manager',
    label: 'Assistant Manager',
    color: 'text-amber-400 bg-amber-500/20',
    category: ROLE_CATEGORIES.ADMINISTRATION,
    level: 22,
    canAccessAdminPanel: true,
  },
  manager: {
    id: 'manager',
    label: 'Manager',
    color: 'text-yellow-400 bg-yellow-500/20',
    category: ROLE_CATEGORIES.ADMINISTRATION,
    level: 23,
    canAccessAdminPanel: true,
  },
  
  // === EXECUTIVE ===
  executive_chairman: {
    id: 'executive_chairman',
    label: 'Executive Chairman',
    color: 'text-amber-300 bg-gradient-to-r from-amber-500/30 to-yellow-500/30',
    category: ROLE_CATEGORIES.EXECUTIVE,
    level: 30,
    canAccessAdminPanel: true,
  },
  owner: {
    id: 'owner',
    label: 'Managing Director',
    color: 'text-amber-200 bg-gradient-to-r from-amber-400/30 via-yellow-400/30 to-orange-400/30',
    category: ROLE_CATEGORIES.EXECUTIVE,
    level: 31,
    canAccessAdminPanel: true,
  },
} as const

// Role ID type
export type RoleId = keyof typeof ROLES

// Get role info by ID
export function getRole(roleId: string) {
  return ROLES[roleId as RoleId] || ROLES.member
}

// Get role label
export function getRoleLabel(roleId: string): string {
  return getRole(roleId).label
}

// Get role color classes
export function getRoleColor(roleId: string): string {
  return getRole(roleId).color
}

// Get role level (for hierarchy comparison)
export function getRoleLevel(roleId: string): number {
  return getRole(roleId).level
}

// Check if role can access admin panel
export function canAccessAdminPanel(roleId: string): boolean {
  return getRole(roleId).canAccessAdminPanel
}

// Check if user A has higher or equal role than user B
export function hasHigherOrEqualRole(roleA: string, roleB: string): boolean {
  return getRoleLevel(roleA) >= getRoleLevel(roleB)
}

// Check if user A has strictly higher role than user B
export function hasHigherRole(roleA: string, roleB: string): boolean {
  return getRoleLevel(roleA) > getRoleLevel(roleB)
}

// Get all roles in a category
export function getRolesByCategory(category: string) {
  return Object.values(ROLES).filter(role => role.category === category)
}

// Get all role IDs
export const ALL_ROLE_IDS = Object.keys(ROLES) as RoleId[]

// Valid roles for selection (in dropdowns, etc.)
export const VALID_ROLES = ALL_ROLE_IDS

// Role groups for permission checks
export const MODERATION_ROLES = ['intern_mod', 'mod', 'senior_mod', 'head_mod'] as const
export const ADMIN_ROLES = ['admin', 'head_staff', 'assistant_manager', 'manager'] as const
export const EXECUTIVE_ROLES = ['executive_chairman', 'owner'] as const
export const STAFF_ROLES = [...MODERATION_ROLES, ...ADMIN_ROLES, ...EXECUTIVE_ROLES] as const

// Permission helpers
export function isModerator(roleId: string): boolean {
  return MODERATION_ROLES.includes(roleId as any)
}

export function isAdmin(roleId: string): boolean {
  return ADMIN_ROLES.includes(roleId as any) || isExecutive(roleId)
}

export function isExecutive(roleId: string): boolean {
  return EXECUTIVE_ROLES.includes(roleId as any)
}

export function isStaff(roleId: string): boolean {
  return STAFF_ROLES.includes(roleId as any)
}

// Check if a user can manage another user's role
export function canManageRole(actorRole: string, targetCurrentRole: string, targetNewRole: string): boolean {
  const actorLevel = getRoleLevel(actorRole)
  const targetCurrentLevel = getRoleLevel(targetCurrentRole)
  const targetNewLevel = getRoleLevel(targetNewRole)
  
  // Can't manage someone with higher or equal role
  if (actorLevel <= targetCurrentLevel) return false
  
  // Can't assign a role higher or equal to own role
  if (actorLevel <= targetNewLevel) return false
  
  // Executive roles can only be managed by owners
  if (isExecutive(targetNewRole) && actorRole !== 'owner') return false
  
  return true
}

// Get roles that a user can assign
export function getAssignableRoles(actorRole: string): string[] {
  const actorLevel = getRoleLevel(actorRole)
  
  return ALL_ROLE_IDS.filter(roleId => {
    const roleLevel = getRoleLevel(roleId)
    // Can only assign roles lower than own level
    if (roleLevel >= actorLevel) return false
    
    // Only owners can assign executive roles
    if (isExecutive(roleId) && actorRole !== 'owner') return false
    
    return true
  })
}

// Role display for admin panel
export const ROLE_GROUPS = [
  {
    category: 'Member Roles',
    description: 'No admin panel access',
    roles: getRolesByCategory(ROLE_CATEGORIES.MEMBER)
  },
  {
    category: 'Moderation Team',
    description: 'Basic moderation tools',
    roles: getRolesByCategory(ROLE_CATEGORIES.MODERATION)
  },
  {
    category: 'Administration',
    description: 'Full admin access',
    roles: getRolesByCategory(ROLE_CATEGORIES.ADMINISTRATION)
  },
  {
    category: 'Executive',
    description: 'Platform leadership',
    roles: getRolesByCategory(ROLE_CATEGORIES.EXECUTIVE)
  },
]
