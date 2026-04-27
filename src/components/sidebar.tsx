'use client'

import { useState, useEffect, useRef, useCallback, startTransition } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { usePersonas } from '@/hooks/use-personas'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EditProfileModal } from '@/components/edit-profile-modal'
import { LegalModal } from '@/components/legal-modal'
import { apiFetch } from '@/lib/api-client'

import { 
  Users, Compass, Plus, Crown, Sparkles, LogOut, Wand2, Check,
  ChevronRight, UserPlus, Settings, LogIn, X, Heart, Edit2, Wallet, Shield, ShoppingBag,
  FileText, Scale, Trophy, PanelLeft, LayoutList, Calendar
} from 'lucide-react'

// Types
interface StorylineItem {
  id: string
  name: string
  iconUrl: string | null
  category: string
  role: string
  memberCount: number
  channels: { id: string; name: string }[]
}

interface SidebarProps {
  activeTab: 'home' | 'friends' | 'storylines' | 'chat' | 'wallet' | 'admin' | 'marketplace'
  activeStorylineId: string | null
  onSelectTab: (tab: 'home' | 'friends' | 'storylines' | 'chat' | 'wallet' | 'admin' | 'marketplace') => void
  onSelectStoryline: (storylineId: string) => void
  onCreatePersona: () => void
}

// Custom event name for storyline refresh
export const STORYLINE_REFRESH_EVENT = 'chrona:storyline-refresh'

export function Sidebar({
  activeTab,
  activeStorylineId,
  onSelectTab,
  onSelectStoryline,
  onCreatePersona
}: SidebarProps) {
  const { user, accounts, logout, setUser, switchAccount, removeAccount } = useAuth()
  const { personas, activePersona, activatePersona } = usePersonas()
  
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isAccountSwitcherOpen, setIsAccountSwitcherOpen] = useState(false)
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false)
  const [legalModalTab, setLegalModalTab] = useState<'tos' | 'privacy' | 'tar' | null>(null)

  const [showAddAccountModal, setShowAddAccountModal] = useState(false)
  const [addAccountMode, setAddAccountMode] = useState<'login' | 'signup'>('login')
  const [addAccountForm, setAddAccountForm] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  })
  const [addAccountDob, setAddAccountDob] = useState({ day: '', month: '', year: '' })
  const [addAccountDobError, setAddAccountDobError] = useState('')
  const [addAccountError, setAddAccountError] = useState('')
  const [isAddingAccount, setIsAddingAccount] = useState(false)
  
  // Security key modal state
  const [showSecurityKeyModal, setShowSecurityKeyModal] = useState(false)
  const [securityKey, setSecurityKey] = useState('')
  const [securityKeyInput, setSecurityKeyInput] = useState('')
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [isSecurityKeyFlow, setIsSecurityKeyFlow] = useState(false)
  const [hasCopiedKey, setHasCopiedKey] = useState(false)
  
  // Reveal security key state
  const [showRevealKeyConfirm, setShowRevealKeyConfirm] = useState(false)
  const [isGeneratingKey, setIsGeneratingKey] = useState(false)
  
  // Navigation mode state
  const [navigationMode, setNavigationMode] = useState<'static' | 'linear'>('static')
  const [isUpdatingNavigation, setIsUpdatingNavigation] = useState(false)

  const [storylines, setStorylines] = useState<StorylineItem[]>([])
  
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const accountSwitcherRef = useRef<HTMLDivElement>(null)

  // Sync navigation mode from user data and localStorage
  useEffect(() => {
    if (user?.navigationMode === 'linear' || user?.navigationMode === 'static') {
      startTransition(() => { setNavigationMode(user.navigationMode as 'static' | 'linear') })
    } else {
      try {
        const stored = localStorage.getItem('chrona-navigation-mode')
        if (stored === 'linear' || stored === 'static') startTransition(() => { setNavigationMode(stored) })
      } catch {}
    }
  }, [user])

  // Listen for navigation mode changes from other components
  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<{ mode: string }>
      const mode = customEvent.detail?.mode
      if (mode === 'linear' || mode === 'static') {
        setNavigationMode(mode)
      }
    }
    window.addEventListener('chrona:navigation-mode-changed', handler)
    return () => window.removeEventListener('chrona:navigation-mode-changed', handler)
  }, [])

  // Handle switching navigation mode
  const handleSwitchNavigationMode = async (mode: 'static' | 'linear') => {
    setIsUpdatingNavigation(true)
    try {
      localStorage.setItem('chrona-navigation-mode', mode)
      const response = await apiFetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ navigationMode: mode }),
      })
      if (response.ok) {
        setNavigationMode(mode)
        if (user) {
          setUser({ ...user, navigationMode: mode })
        }
        window.dispatchEvent(new CustomEvent('chrona:navigation-mode-changed', { detail: { mode } }))
        setIsProfileMenuOpen(false)
      }
    } catch (error) {
      console.error('Failed to update navigation mode:', error)
    } finally {
      setIsUpdatingNavigation(false)
    }
  }

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false)
      }
      if (accountSwitcherRef.current && !accountSwitcherRef.current.contains(event.target as Node)) {
        setIsAccountSwitcherOpen(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch joined storylines - as a callback so it can be called on demand
  const fetchStorylines = useCallback(async () => {
    try {
      const response = await apiFetch('/api/storylines/joined')
      if (response.ok) {
        const data = await response.json()
        setStorylines(data.storylines)
      }
    } catch (error) {
      console.error('Failed to fetch storylines:', error)
    }
  }, [])
  
  // Initial fetch on mount
  useEffect(() => {
    startTransition(() => { fetchStorylines() })
  }, [fetchStorylines])
  
  // Listen for storyline refresh events
  useEffect(() => {
    const handleRefresh = () => {
      fetchStorylines()
    }
    
    // Listen for edit profile and my personas events from topbar dropdown
    const handleOpenEditProfile = () => {
      setIsEditProfileOpen(true)
    }
    const handleOpenMyPersonas = () => {
      setIsProfileMenuOpen(false)
      // Dispatch event for page.tsx to handle (opens personas modal)
      window.dispatchEvent(new CustomEvent('chrona:show-personas-modal'))
    }
    
    window.addEventListener(STORYLINE_REFRESH_EVENT, handleRefresh)
    window.addEventListener('chrona:open-edit-profile', handleOpenEditProfile)
    window.addEventListener('chrona:open-my-personas', handleOpenMyPersonas)
    return () => {
      window.removeEventListener(STORYLINE_REFRESH_EVENT, handleRefresh)
      window.removeEventListener('chrona:open-edit-profile', handleOpenEditProfile)
      window.removeEventListener('chrona:open-my-personas', handleOpenMyPersonas)
    }
  }, [fetchStorylines])
  
  // Handle switching account
  const handleSwitchAccount = async (userId: string) => {
    try {
      setIsAccountSwitcherOpen(false)
      setIsProfileMenuOpen(false)
      
      await switchAccount(userId)
      
      // Reload the page to ensure the new account is fully loaded
      window.location.reload()
    } catch (error) {
      console.error('Failed to switch account:', error)
    }
  }
  
  // Handle removing account
  const handleRemoveAccount = async (userId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Remove this account from the list?')) return
    
    try {
      await removeAccount(userId)
    } catch (error) {
      console.error('Failed to remove account:', error)
    }
  }
  
  // Handle add account (login or signup)
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddAccountError('')
    setAddAccountDobError('')
    
    // Validate DOB for signup mode
    if (addAccountMode === 'signup') {
      if (!addAccountDob.day || !addAccountDob.month || !addAccountDob.year) {
        setAddAccountDobError('Date of birth is required')
        return
      }
      const dayNum = parseInt(addAccountDob.day)
      const monthNum = parseInt(addAccountDob.month)
      const yearNum = parseInt(addAccountDob.year)
      const dobDate = new Date(yearNum, monthNum - 1, dayNum, 12, 0, 0)
      const today = new Date()
      let age = today.getFullYear() - dobDate.getFullYear()
      const monthDiff = today.getMonth() - dobDate.getMonth()
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) age--
      if (dobDate.getFullYear() !== yearNum || dobDate.getMonth() !== monthNum - 1 || dobDate.getDate() !== dayNum) {
        setAddAccountDobError('Invalid date of birth')
        return
      }
      if (age < 16) {
        setAddAccountDobError('You must be at least 16 years old to use Chrona')
        return
      }
    }
    
    setIsAddingAccount(true)
    
    try {
      const endpoint = addAccountMode === 'login' ? '/api/auth/login' : '/api/auth/signup'
      let signupDob: string | undefined
      if (addAccountMode === 'signup' && addAccountDob.day && addAccountDob.month && addAccountDob.year) {
        const d = new Date(parseInt(addAccountDob.year), parseInt(addAccountDob.month) - 1, parseInt(addAccountDob.day), 12, 0, 0)
        signupDob = d.toISOString()
      }
      const body = addAccountMode === 'login' 
        ? { username: addAccountForm.username, password: addAccountForm.password }
        : { username: addAccountForm.username, password: addAccountForm.password, confirmPassword: addAccountForm.confirmPassword, dateOfBirth: signupDob }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add account')
      }
      
      if (addAccountMode === 'signup') {
        // Show the security key that was generated
        setSecurityKey(data.securityKey)
        setPendingUserId(data.user.id)
        setIsSecurityKeyFlow(false)
        setHasCopiedKey(false)
        setShowAddAccountModal(false)
        setShowSecurityKeyModal(true)
      } else {
        // Login flow - need to verify security key
        setPendingUserId(data.user.id)
        setSecurityKeyInput('')
        setIsSecurityKeyFlow(true)
        setShowAddAccountModal(false)
        setShowSecurityKeyModal(true)
      }
      
    } catch (error) {
      setAddAccountError(error instanceof Error ? error.message : 'Failed to add account')
    } finally {
      setIsAddingAccount(false)
    }
  }
  
  // Copy security key to clipboard
  const copySecurityKey = () => {
    navigator.clipboard.writeText(securityKey)
    setHasCopiedKey(true)
    setTimeout(() => setHasCopiedKey(false), 2000)
  }
  
  // Handle security key confirmation (after showing key for signup)
  const handleConfirmSecurityKeySaved = () => {
    setIsSecurityKeyFlow(true)
    setSecurityKeyInput('')
    setAddAccountError('')
  }
  
  // Verify security key
  const handleVerifySecurityKey = async () => {
    if (!pendingUserId || !securityKeyInput.trim()) return
    
    setAddAccountError('')
    setIsAddingAccount(true)
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: pendingUserId, 
          securityKey: securityKeyInput.trim().toUpperCase() 
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Invalid security key')
      }
      
      // Success - refresh to update session
      window.location.reload()
      
    } catch (error) {
      setAddAccountError(error instanceof Error ? error.message : 'Verification failed')
    } finally {
      setIsAddingAccount(false)
    }
  }
  
  // Handle revealing/generating new security key
  const handleRevealSecurityKey = async () => {
    setIsGeneratingKey(true)
    
    try {
      const response = await apiFetch('/api/auth/security-key', {
        method: 'POST',
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate security key')
      }
      
      // Show the new security key
      setSecurityKey(data.securityKey)
      setPendingUserId(user?.id || null) // Set current user as pending for verification
      setIsSecurityKeyFlow(false)
      setHasCopiedKey(false)
      setShowRevealKeyConfirm(false)
      setShowSecurityKeyModal(true)
      
    } catch (error) {
      console.error('Failed to generate security key:', error)
      alert('Failed to generate security key. Please try again.')
    } finally {
      setIsGeneratingKey(false)
    }
  }
  
  return (
    <div className="w-56 flex flex-col h-full flex-shrink-0 relative bg-gradient-to-b from-[#0e1015] to-[#090517] border-r border-white/[0.08]">
      {/* Decorative top glow */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/[0.05] to-transparent pointer-events-none z-0" />
      
      {/* Header with Logo */}
      <div className="relative z-10 p-4 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img 
              src="/logo.png" 
              alt="Chrona" 
              className="w-10 h-10 rounded-xl shadow-lg shadow-teal-500/20 object-cover"
            />
            <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-fuchsia-400" />
          </div>
          <div>
            <h1 className="font-bold text-lg bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">Chrona</h1>
            <p className="text-[10px] text-slate-500 tracking-wider">Roleplay Universe</p>
          </div>
        </div>
      </div>
      
      {/* Scrollable Content Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative z-10">
        {/* Navigation */}
        <div className="p-3 space-y-1 flex-shrink-0">
          {/* Discover */}
          <button
            onClick={() => onSelectTab('home')}
            className={`persona-nav-item w-full ${activeTab === 'home' ? 'persona-nav-item-active' : ''}`}
          >
            <Compass className="w-5 h-5" />
            <span className="font-medium">Discover</span>
          </button>
          
          {/* Friends */}
          <button
            onClick={() => onSelectTab('friends')}
            className={`persona-nav-item w-full ${activeTab === 'friends' ? 'persona-nav-item-active' : ''}`}
          >
            <Users className="w-5 h-5" />
            <span className="font-medium">Friends</span>
          </button>
          
          {/* Storylines */}
          <button
            onClick={() => onSelectTab('storylines')}
            className={`persona-nav-item w-full ${activeTab === 'storylines' ? 'persona-nav-item-active' : ''}`}
          >
            <Crown className="w-5 h-5" />
            <span className="font-medium">Storylines</span>
          </button>
          
          {/* Marketplace */}
          <button
            onClick={() => onSelectTab('marketplace')}
            className={`persona-nav-item w-full ${activeTab === 'marketplace' ? 'persona-nav-item-active' : ''}`}
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="font-medium">Marketplace</span>
          </button>
          
          {/* Admin - Only visible to staff */}
          {user && ['mod', 'admin', 'owner'].includes(user.role) && (
            <button
              onClick={() => onSelectTab('admin')}
              className={`persona-nav-item w-full ${activeTab === 'admin' ? 'persona-nav-item-active' : ''}`}
            >
              <Shield className="w-5 h-5" />
              <span className="font-medium">Admin</span>
            </button>
          )}
          
          {/* Chronos */}
          <button
            onClick={() => onSelectTab('wallet')}
            className={`persona-nav-item w-full ${activeTab === 'wallet' ? 'persona-nav-item-active' : ''}`}
          >
            <Wallet className="w-5 h-5" />
            <span className="font-medium">Chronos</span>
          </button>

          {/* Achievements */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('chrona:open-achievements'))}
            className="persona-nav-item w-full"
          >
            <Trophy className="w-5 h-5" />
            <span className="font-medium">Achievements</span>
          </button>
        </div>
        
        {/* My Personas Section */}
        <div className="flex-shrink-0 mt-1">
          <div className="px-4 flex items-center justify-between mb-1">
            <span className="persona-section-header">My Characters</span>
            <button 
              onClick={onCreatePersona}
              className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-300 hover:bg-white/[0.05] transition-all"
              title="Create new character"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          
          <div className="px-3 space-y-0.5">
            {personas.length === 0 ? (
              <button
                onClick={onCreatePersona}
                className="w-full p-3 rounded-lg border border-dashed border-teal-500/20 flex items-center justify-center gap-2 text-slate-500 hover:text-slate-300 hover:border-teal-500/30 transition-all"
              >
                <Wand2 className="w-4 h-4" />
                <span className="text-sm">Create your first character</span>
              </button>
            ) : (
              <>
                {personas.map((persona) => (
                  <button
                    key={persona.id}
                    onClick={() => activatePersona(persona.id)}
                    className={`persona-dm-item w-full ${persona.isActive ? 'persona-dm-item-active border-l-2 border-l-teal-500' : ''}`}
                  >
                    <Avatar className="w-8 h-8 border border-teal-500/20">
                      <AvatarImage src={persona.avatarUrl || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-teal-500/40 to-cyan-500/50 text-white text-xs font-medium">
                        {persona.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-slate-100 truncate">{persona.name}</p>
                    </div>
                    {persona.isActive && (
                      <span className="flex items-center gap-1 text-xs text-emerald-400">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                ))}
                <button
                  onClick={onCreatePersona}
                  className="w-full p-2 rounded-lg border border-white/[0.08] flex items-center justify-center gap-2 text-slate-500 hover:text-slate-300 hover:bg-white/[0.05] transition-all text-xs"
                >
                  <Plus className="w-3 h-3" />
                  <span>New character</span>
                </button>
              </>
            )}
          </div>
        </div>
        
        {/* Storylines Section */}
        {storylines.length > 0 && (
          <div className="flex-1 flex flex-col min-h-0 mt-3 overflow-hidden">
            <div className="px-4 flex items-center justify-between mb-1 flex-shrink-0">
              <span className="persona-section-header">My Storylines</span>
              <button
                onClick={() => onSelectTab('storylines')}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                View all
              </button>
            </div>
            <ScrollArea className="flex-1 px-3 min-h-0">
              <div className="space-y-0.5">
                {storylines.map((sl) => (
                  <button
                    key={sl.id}
                    onClick={() => onSelectStoryline(sl.id)}
                    className={`persona-dm-item w-full ${activeStorylineId === sl.id ? 'persona-dm-item-active' : ''}`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-400 flex items-center justify-center overflow-hidden border border-teal-500/20 flex-shrink-0">
                      {sl.iconUrl ? (
                        <img src={sl.iconUrl} alt={sl.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-bold text-xs">{sl.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-slate-100 truncate">{sl.name}</p>
                      <p className="text-xs text-slate-500">{sl.role}</p>
                    </div>
                    {sl.role === 'owner' && (
                      <Crown className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
        
        {storylines.length === 0 && (
          <div className="px-3 mt-3 flex-shrink-0">
            <button
              onClick={() => onSelectTab('storylines')}
              className="w-full p-3 rounded-lg border border-dashed border-teal-500/20 flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-slate-300 hover:border-teal-500/30 transition-all"
            >
              <Crown className="w-4 h-4" />
              <span className="text-xs">Join or create a storyline</span>
            </button>
          </div>
        )}
      </div>
      
      {/* User Panel - Fixed at bottom */}
      <div className="persona-user-panel relative z-20 flex-shrink-0" ref={profileMenuRef}>
        <button 
          onClick={() => setIsProfileMenuOpen((prev) => !prev)} 
          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.05] transition-colors"
        >
          <div className="relative">
            <Avatar className="w-10 h-10 border-2 border-teal-500/25">
              <AvatarImage src={user?.avatarUrl || activePersona?.avatarUrl || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-teal-500 to-cyan-400 text-white font-medium">
                {(user?.username || activePersona?.name || 'U').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0e1015] animate-pulse" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold text-slate-100 truncate">{user?.username || activePersona?.name}</p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <p className="text-xs text-slate-400">Online</p>
            </div>
          </div>
        </button>

        {/* Profile Menu Dropdown */}
        {isProfileMenuOpen && (
          <div className="absolute bottom-full left-0 right-0 mb-2 mx-2 rounded-xl bg-[#110727]/98 border border-white/[0.08] shadow-2xl backdrop-blur-xl p-2 z-[100]">
            {/* Account Header */}
            <div className="px-3 py-2 border-b border-white/[0.08] mb-1">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Account</p>
            </div>
            
            {/* Edit Profile */}
            <button
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-teal-500/15 text-slate-100 transition-colors"
              onClick={() => { setIsEditProfileOpen(true); setIsProfileMenuOpen(false) }}
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <span className="text-sm">Edit Profile</span>
            </button>
            
            {/* Switch Accounts */}
            <button
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-teal-500/15 text-slate-100 transition-colors"
              onClick={() => { setIsAccountSwitcherOpen(true); setIsProfileMenuOpen(false) }}
            >
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-slate-400" />
                <span className="text-sm">Switch Accounts</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
            
            {/* Add Account */}
            <button
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-teal-500/15 text-slate-100 transition-colors"
              onClick={() => { setShowAddAccountModal(true); setIsProfileMenuOpen(false) }}
            >
              <UserPlus className="w-4 h-4 text-slate-400" />
              <span className="text-sm">Add Account</span>
            </button>
            
            {/* Navigation Panel */}
            <div className="px-3 py-2 border-t border-white/[0.08] mt-1 pt-2">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-1.5 flex items-center gap-1.5">
                <PanelLeft className="w-3 h-3" />
                Navigation
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleSwitchNavigationMode('static')}
                  disabled={isUpdatingNavigation || navigationMode === 'static'}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                    navigationMode === 'static'
                      ? 'text-teal-400 bg-teal-500/10 border-teal-500/20'
                      : 'text-slate-500 bg-transparent border-white/[0.06] hover:border-white/10 hover:text-slate-300'
                  }`}
                >
                  <PanelLeft className="w-3 h-3" />
                  Static
                </button>
                <button
                  onClick={() => handleSwitchNavigationMode('linear')}
                  disabled={isUpdatingNavigation || navigationMode === 'linear'}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                    navigationMode === 'linear'
                      ? 'text-violet-400 bg-violet-500/10 border-violet-500/20'
                      : 'text-slate-500 bg-transparent border-white/[0.06] hover:border-white/10 hover:text-slate-300'
                  }`}
                >
                  <LayoutList className="w-3 h-3" />
                  Linear
                </button>
              </div>
            </div>
            
            {/* Legal Links */}
            <div className="px-3 py-2 border-t border-white/[0.08] mt-1 pt-2">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-1">Legal</p>
            </div>
            <button
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-teal-500/15 text-slate-100 transition-colors"
              onClick={() => { setLegalModalTab('tos'); setIsProfileMenuOpen(false) }}
            >
              <FileText className="w-4 h-4 text-slate-400" />
              <span className="text-sm">Terms of Service</span>
            </button>
            <button
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-teal-500/15 text-slate-100 transition-colors"
              onClick={() => { setLegalModalTab('privacy'); setIsProfileMenuOpen(false) }}
            >
              <Shield className="w-4 h-4 text-slate-400" />
              <span className="text-sm">Privacy Policy</span>
            </button>
            <button
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-teal-500/15 text-slate-100 transition-colors"
              onClick={() => { setLegalModalTab('tar'); setIsProfileMenuOpen(false) }}
            >
              <Scale className="w-4 h-4 text-slate-400" />
              <span className="text-sm">Terms & Rules</span>
            </button>
            
            {/* Logout */}
            <button
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-500/20 text-slate-100 transition-colors mt-1 border-t border-white/[0.08] pt-3"
              onClick={() => {
                logout();
                setIsProfileMenuOpen(false);
              }}
            >
              <LogOut className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-400">Log Out</span>
            </button>
          </div>
        )}
        
        {/* Account Switcher Dropdown */}
        {isAccountSwitcherOpen && (
          <div 
            ref={accountSwitcherRef}
            className="absolute bottom-full left-0 right-0 mb-2 mx-2 rounded-xl bg-[#110727]/98 border border-white/[0.08] shadow-2xl backdrop-blur-xl p-2 z-[100]"
          >
            <div className="px-3 py-2 border-b border-white/[0.08] mb-1">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Switch Accounts</p>
            </div>
            
            {/* Account List */}
            <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                    account.isActive 
                      ? 'bg-teal-500/15 text-slate-100' 
                      : 'hover:bg-white/[0.05] text-slate-200'
                  }`}
                  onClick={() => handleSwitchAccount(account.id)}
                >
                  <Avatar className="w-8 h-8 border border-teal-500/20">
                    <AvatarImage src={account.avatarUrl || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-teal-500 to-cyan-400 text-white text-sm font-medium">
                      {account.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{account.username}</p>
                  </div>
                  {account.isActive && (
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  )}
                  {!account.isActive && accounts.length > 1 && (
                    <button
                      onClick={(e) => handleRemoveAccount(account.id, e)}
                      className="w-6 h-6 rounded flex items-center justify-center text-slate-400/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Remove account"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            {/* Add Account Button */}
            <button
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-teal-500/15 text-slate-100 transition-colors mt-2 border-t border-white/[0.08] pt-3"
              onClick={() => { setShowAddAccountModal(true); setIsAccountSwitcherOpen(false) }}
            >
              <UserPlus className="w-4 h-4 text-slate-400" />
              <span className="text-sm">Add Account</span>
            </button>
          </div>
        )}

        {/* Edit Profile Modal */}
        <EditProfileModal 
          isOpen={isEditProfileOpen}
          onClose={() => setIsEditProfileOpen(false)}
          onRevealSecurityKey={() => {
            setIsEditProfileOpen(false)
            setShowRevealKeyConfirm(true)
          }}
        />

        {/* Legal Modal */}
        <LegalModal 
          isOpen={legalModalTab !== null}
          onClose={() => setLegalModalTab(null)}
          defaultTab={legalModalTab || 'tos'}
        />

        {/* Reveal Security Key Confirmation Modal */}
        {showRevealKeyConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm bg-gradient-to-b from-[#150a25] to-[#0a0510] rounded-2xl border border-amber-500/30 shadow-2xl overflow-hidden">
              <div className="p-5 border-b border-white/[0.08]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                    <span className="text-lg">⚠️</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Generate New Key?</h2>
                    <p className="text-sm text-slate-400">This action cannot be undone</p>
                  </div>
                </div>
              </div>
              
              <div className="p-5">
                <p className="text-sm text-slate-300/80 mb-4">
                  This will generate a <strong className="text-amber-300">new security key</strong> for your account. 
                  Your previous key will be invalidated immediately.
                </p>
                
                <div className="bg-slate-900/25 rounded-lg p-3 mb-4">
                  <p className="text-xs text-slate-500">
                    Make sure to save the new key somewhere safe - you&apos;ll need it every time you log in.
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowRevealKeyConfirm(false)}
                    className="flex-1 py-2.5 rounded-lg border border-teal-500/20 text-slate-300 text-sm hover:bg-white/[0.05] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRevealSecurityKey}
                    disabled={isGeneratingKey}
                    className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isGeneratingKey ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Crown className="w-4 h-4" />
                        Generate New Key
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Add Account Modal */}
        {showAddAccountModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-xl bg-[#0f1117] border border-teal-500/20 p-5 relative">
              <button
                onClick={() => setShowAddAccountModal(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="text-center mb-4">
                <h3 className="text-xl font-semibold text-slate-100">Add Account</h3>
                <p className="text-sm text-slate-500 mt-1">Login or create a new account</p>
              </div>
              
              {/* Mode Toggle */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setAddAccountMode('login')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    addAccountMode === 'login'
                      ? 'bg-teal-500/15 text-slate-100 border border-teal-500/25'
                      : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.05]'
                  }`}
                >
                  <LogIn className="w-4 h-4 inline mr-2" />
                  Login
                </button>
                <button
                  onClick={() => setAddAccountMode('signup')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    addAccountMode === 'signup'
                      ? 'bg-teal-500/15 text-slate-100 border border-teal-500/25'
                      : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.05]'
                  }`}
                >
                  <UserPlus className="w-4 h-4 inline mr-2" />
                  Sign Up
                </button>
              </div>
              
              <form onSubmit={handleAddAccount} className="space-y-4">
                {addAccountError && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {addAccountError}
                  </div>
                )}
                
                <div className="space-y-2">
                  <label className="block text-xs text-slate-300">Username</label>
                  <input
                    type="text"
                    value={addAccountForm.username}
                    onChange={(e) => setAddAccountForm({ ...addAccountForm, username: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0e1015] border border-teal-500/20 text-white placeholder-slate-500/40 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="cooluser123"
                    required
                  />
                  {addAccountMode === 'signup' && (
                    <p className="text-xs text-slate-500">Letters, numbers, and underscores. 3-20 characters.</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="block text-xs text-slate-300">Password</label>
                  <input
                    type="password"
                    value={addAccountForm.password}
                    onChange={(e) => setAddAccountForm({ ...addAccountForm, password: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0e1015] border border-teal-500/20 text-white placeholder-slate-500/40 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="••••••••"
                    required
                  />
                  {addAccountMode === 'signup' && (
                    <p className="text-xs text-slate-500">At least 6 characters.</p>
                  )}
                </div>
                
                {addAccountMode === 'signup' && (
                  <div className="space-y-2">
                    <label className="block text-xs text-slate-300">Confirm Password</label>
                    <input
                      type="password"
                      value={addAccountForm.confirmPassword}
                      onChange={(e) => setAddAccountForm({ ...addAccountForm, confirmPassword: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-[#0e1015] border border-teal-500/20 text-white placeholder-slate-500/40 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                )}
                
                {addAccountMode === 'signup' && (
                  <div className="space-y-2">
                    <label className="block text-xs text-slate-300 flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-teal-400" />
                      Date of Birth
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={addAccountDob.day}
                        onChange={(e) => setAddAccountDob({ ...addAccountDob, day: e.target.value })}
                        required
                        className="w-full px-2 py-2 rounded-lg bg-[#0e1015] border border-teal-500/20 text-white text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="">Day</option>
                        {Array.from({ length: 31 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>{i + 1}</option>
                        ))}
                      </select>
                      <select
                        value={addAccountDob.month}
                        onChange={(e) => setAddAccountDob({ ...addAccountDob, month: e.target.value })}
                        required
                        className="w-full px-2 py-2 rounded-lg bg-[#0e1015] border border-teal-500/20 text-white text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="">Month</option>
                        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
                          <option key={i + 1} value={i + 1}>{m}</option>
                        ))}
                      </select>
                      <select
                        value={addAccountDob.year}
                        onChange={(e) => setAddAccountDob({ ...addAccountDob, year: e.target.value })}
                        required
                        className="w-full px-2 py-2 rounded-lg bg-[#0e1015] border border-teal-500/20 text-white text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="">Year</option>
                        {Array.from({ length: 100 }, (_, i) => {
                          const year = new Date().getFullYear() - 16 - i
                          return <option key={year} value={year}>{year}</option>
                        })}
                      </select>
                    </div>
                    {addAccountDobError && <p className="text-xs text-red-400">{addAccountDobError}</p>}
                    <p className="text-[10px] text-slate-500">You must be 16 or older to use Chrona.</p>
                  </div>
                )}
                
                <button
                  type="submit"
                  disabled={isAddingAccount}
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isAddingAccount ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </span>
                  ) : addAccountMode === 'login' ? (
                    'Login'
                  ) : (
                    'Create Account'
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
        
        {/* Security Key Modal */}
        {showSecurityKeyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-gradient-to-b from-[#150a25] to-[#0a0510] rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden">
              {/* Modal Header */}
              <div className="p-6 border-b border-white/[0.08] bg-gradient-to-r from-slate-900/20 to-cyan-900/15">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-400 flex items-center justify-center">
                    <Crown className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      {isSecurityKeyFlow ? 'Security Verification' : 'Save Your Security Key'}
                    </h2>
                    <p className="text-sm text-slate-400">
                      {isSecurityKeyFlow ? 'Enter your security key to continue' : 'This key is required for every login'}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Modal Content */}
              <div className="p-6">
                {!isSecurityKeyFlow ? (
                  /* Show Security Key (First Time - Signup) */
                  <div className="space-y-4">
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                          <Heart className="w-4 h-4 text-amber-400" />
                        </div>
                        <div>
                          <p className="text-amber-300 font-medium text-sm">Important!</p>
                          <p className="text-amber-200/70 text-xs mt-1">
                            Save this key somewhere safe. You&apos;ll need it every time you log in. We won&apos;t show it again.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Security Key Display */}
                    <div className="bg-slate-900/25 rounded-xl p-4 border border-white/[0.08]">
                      <p className="text-xs text-slate-500 mb-2 text-center">Your Security Key</p>
                      <div className="bg-black/30 rounded-lg p-3 font-mono text-xl text-center tracking-wider text-slate-100 select-all">
                        {securityKey}
                      </div>
                    </div>
                    
                    {/* Copy Button */}
                    <button 
                      onClick={copySecurityKey}
                      className="w-full py-2.5 rounded-lg border border-white/[0.08] text-sm text-slate-300 hover:bg-white/[0.05] transition-colors flex items-center justify-center gap-2"
                    >
                      {hasCopiedKey ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          Copied to clipboard!
                        </>
                      ) : (
                        <>
                          <Edit2 className="w-4 h-4" />
                          Copy to clipboard
                        </>
                      )}
                    </button>
                    
                    {/* Continue Button */}
                    <button 
                      onClick={handleConfirmSecurityKeySaved}
                      className="w-full h-11 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                    >
                      I&apos;ve saved my key
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  /* Enter Security Key (Login or after confirming signup) */
                  <div className="space-y-4">
                    {addAccountError && (
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                        {addAccountError}
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <label className="block text-xs text-slate-300">Enter your security key</label>
                      <input
                        type="text"
                        value={securityKeyInput}
                        onChange={(e) => setSecurityKeyInput(e.target.value.toUpperCase())}
                        className="w-full px-3 py-3 rounded-lg bg-[#0e1015] border border-teal-500/20 text-white text-center font-mono text-lg tracking-wider placeholder-slate-500/40 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="XXXX-XXXX-XXXX-XXXX"
                        maxLength={19}
                      />
                      <p className="text-xs text-slate-500 text-center">Enter the 16-character key you saved</p>
                    </div>
                    
                    <button
                      onClick={handleVerifySecurityKey}
                      disabled={isAddingAccount || !securityKeyInput.trim()}
                      className="w-full h-11 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {isAddingAccount ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          Verify & Continue
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={() => {
                        setShowSecurityKeyModal(false)
                        setSecurityKeyInput('')
                        setSecurityKey('')
                        setPendingUserId(null)
                        setAddAccountError('')
                      }}
                      className="w-full py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
