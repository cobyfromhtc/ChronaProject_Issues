'use client'

// Force rebuild - v3 (performance optimized)
import React, { useState, useRef, useEffect, useCallback, useMemo, lazy, Suspense } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { isAdult } from '@/lib/age-utils'
import { usePersonas } from '@/hooks/use-personas'
import { useChat, ChatMessage } from '@/hooks/use-chat'
import { extractMentions, parseMessageContent } from '@/lib/mentions'
import { parseMessageWithMarkdown, wrapSelection } from '@/lib/markdown'
import { setSessionToken, addStoredAccount, apiFetch } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { 
  Loader2, UserPlus, LogIn, LogOut, Users, MessageCircle, 
  User, Bell, Search, Settings, ChevronRight, Plus, Check,
  Edit2, Trash2, Camera, X, Send, ArrowLeft, MessageSquare,
  Sparkles, Zap, Image as ImageIcon, Wand2, Heart, Crown,
  BookOpen, Compass, Star, Minus, Maximize2, Minimize2,
  Store, Coins, Flag, Download, Upload, Calendar, Shield
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

// Import lightweight/eagerly loaded components
import { Sidebar } from '@/components/sidebar'
import { NavigationTopbar } from '@/components/navigation-topbar'
import { DMSidebar, DM_REFRESH_EVENT } from '@/components/dm-sidebar'
import { FriendsPage } from '@/components/friends-page'
import { StorylinesPage } from '@/components/storylines-page'
import { Persona, PersonaConnection, PersonalitySpectrums } from '@/stores/persona-store'
import type { FormData as PersonaFormData } from '@/components/persona-form'
import { NotificationModal } from '@/components/notification-modal'
import { AchievementModal } from '@/components/achievement-modal'
import { EditProfileModal } from '@/components/edit-profile-modal'
import { FeaturedStorylinesBanner } from '@/components/featured-storylines-banner'
import { useToast } from '@/hooks/use-toast'
import { BLORP_USER_ID } from '@/lib/blorp'
import { LoadingScreen } from '@/components/loading-screen'
import { Skeleton } from '@/components/ui/skeleton'
import { ChunkErrorBoundary } from '@/components/chunk-error-boundary'
import { useUIVariant, type UIVariant } from '@/stores/ui-variant-store'
import { useVariantAccent } from '@/lib/ui-variant-styles'

// Layout shells for different UI variants
const HorizonShell = lazy(() => import('@/components/layouts/horizon-shell').then(m => ({ default: m.HorizonShell })))
const PulseShell = lazy(() => import('@/components/layouts/pulse-shell').then(m => ({ default: m.PulseShell })))
const NexusShell = lazy(() => import('@/components/layouts/nexus-shell').then(m => ({ default: m.NexusShell })))
const ChronaV2Shell = lazy(() => import('@/components/layouts/chrona-v2-shell').then(m => ({ default: m.ChronaV2Shell })))
const ChronaV3Shell = lazy(() => import('@/components/layouts/chrona-v3-shell').then(m => ({ default: m.ChronaV3Shell })))

// Lazy-loaded heavy components (code-split for performance)
const StorylineInterior = lazy(() => import('@/components/storyline-interior').then(m => ({ default: m.StorylineInterior })))
const PersonaForm = lazy(() => import('@/components/persona-form').then(m => ({ default: m.PersonaForm })))
const CharacterProfileModal = lazy(() => import('@/components/character-profile-modal').then(m => ({ default: m.CharacterProfileModal })))
const WalletPage = lazy(() => import('@/components/wallet-page').then(m => ({ default: m.WalletPage })))
const AdminPanel = lazy(() => import('@/components/admin-panel').then(m => ({ default: m.AdminPanel })))
const MarketplacePage = lazy(() => import('@/components/marketplace-page').then(m => ({ default: m.MarketplacePage })))
const ListOnMarketplaceModal = lazy(() => import('@/components/list-on-marketplace-modal').then(m => ({ default: m.ListOnMarketplaceModal })))
const AdvancedSearch = lazy(() => import('@/components/advanced-search').then(m => ({ default: m.AdvancedSearch })))
const ReportModal = lazy(() => import('@/components/report-modal').then(m => ({ default: m.ReportModal })))
const ChatLandingPage = lazy(() => import('@/components/chat-landing-page').then(m => ({ default: m.ChatLandingPage })))

// PersonaCard is already wrapped in React.memo in its own module
import { PersonaCard } from '@/components/persona-card'

// Suspense fallback for lazy-loaded components
function ComponentSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center p-8 ${className}`}>
      <div className="space-y-4 w-full max-w-md">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-32 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    </div>
  )
}

// Modal skeleton fallback (centered, smaller)
function ModalSkeleton() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="space-y-4 w-full max-w-md">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-40 w-full rounded-lg" />
        <div className="flex gap-2 justify-end">
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

// ==================== TYPES ====================
interface PersonaConnectionData {
  id: string
  characterName: string
  relationshipType: string
  specificRole: string | null
  characterAge: number | null
  description: string | null
}

interface OnlinePersona {
  id: string
  name: string
  avatarUrl: string | null
  bannerUrl: string | null
  bio: string | null
  username: string
  userId: string
  isOnline: boolean
  // Extended profile fields
  archetype: string | null
  gender: string | null
  age: number | null
  tags: string[]
  personalityDescription: string | null
  personalitySpectrums: {
    introvertExtrovert: number
    intuitiveObservant: number
    thinkingFeeling: number
    judgingProspecting: number
    assertiveTurbulent: number
  } | null
  bigFive: {
    openness: number
    conscientiousness: number
    extraversion: number
    agreeableness: number
    neuroticism: number
  } | null
  hexaco: {
    honestyHumility: number
    emotionality: number
    extraversion: number
    agreeableness: number
    conscientiousness: number
    opennessToExperience: number
  } | null
  strengths: string[]
  flaws: string[]
  values: string[]
  fears: string[]
  species: string | null
  likes: string[]
  dislikes: string[]
  hobbies: string[]
  skills: string[]
  languages: string[]
  habits: string[]
  speechPatterns: string[]
  backstory: string | null
  appearance: string | null
  mbtiType: string | null
  rpStyle: string | null
  connections: PersonaConnectionData[]
}

export interface Conversation {
  id: string
  otherPersona?: {
    id: string
    name: string
    avatarUrl: string | null
    username: string
    isOnline: boolean
  }
  myPersona: {
    id: string
    name: string
  }
  lastMessage: {
    content: string
    createdAt: string
  } | null
  lastMessageAt: string
  createdAt: string
}

// ==================== AUTH PAGE ====================
function AuthPage() {
  const { login, signup, setUser, verifySecurityKey: authVerifySecurityKey } = useAuth()
  
  const [signupForm, setSignupForm] = useState({ username: '', password: '', confirmPassword: '' })
  const [dob, setDob] = useState({ day: '', month: '', year: '' })
  const [dobError, setDobError] = useState('')
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('login')
  
  // Security Key Modal State
  const [showSecurityKeyModal, setShowSecurityKeyModal] = useState(false)
  const [securityKey, setSecurityKey] = useState('')
  const [securityKeyInput, setSecurityKeyInput] = useState('')
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [isLoginFlow, setIsLoginFlow] = useState(false)
  const [hasCopiedKey, setHasCopiedKey] = useState(false)
  
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setDobError('')
    
    // Validate date of birth
    if (!dob.day || !dob.month || !dob.year) {
      setDobError('Date of birth is required')
      return
    }
    const dayNum = parseInt(dob.day)
    const monthNum = parseInt(dob.month)
    const yearNum = parseInt(dob.year)
    const dobDate = new Date(yearNum, monthNum - 1, dayNum, 12, 0, 0)
    const today = new Date()
    let age = today.getFullYear() - dobDate.getFullYear()
    const monthDiff = today.getMonth() - dobDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) {
      age--
    }
    if (dobDate.getFullYear() !== yearNum || dobDate.getMonth() !== monthNum - 1 || dobDate.getDate() !== dayNum) {
      setDobError('Invalid date of birth')
      return
    }
    if (dobDate > today) {
      setDobError('Date of birth cannot be in the future')
      return
    }
    if (age < 16) {
      setDobError('You must be at least 16 years old to use Chrona')
      return
    }
    if (age > 120) {
      setDobError('Please enter a valid date of birth')
      return
    }
    
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...signupForm,
          dateOfBirth: dobDate.toISOString(),
        }),
      })
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Signup failed')
      }
      
      // Show security key modal
      setSecurityKey(data.securityKey)
      setPendingUserId(data.user.id)
      setIsLoginFlow(false)
      setHasCopiedKey(false)
      setShowSecurityKeyModal(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      })
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Login failed')
      }
      
      // Show security key input modal
      setPendingUserId(data.user.id)
      setSecurityKeyInput('')
      setIsLoginFlow(true)
      setShowSecurityKeyModal(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const handleVerifySecurityKey = async () => {
    if (!pendingUserId || !securityKeyInput.trim()) return
    
    setError('')
    setIsSubmitting(true)
    
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
      
      // Store the session token
      if (data.token) {
        setSessionToken(data.token)
        addStoredAccount(data.user, data.token)
      }
      
      // Success - set user and close modal
      setUser(data.user)
      setShowSecurityKeyModal(false)
      setPendingUserId(null)
      setSecurityKeyInput('')
      setSecurityKey('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const handleConfirmSecurityKeySaved = () => {
    // User confirmed they saved the key - now verify it
    setIsLoginFlow(true)
    setSecurityKeyInput('')
    setError('')
  }
  
  const copySecurityKey = () => {
    navigator.clipboard.writeText(securityKey)
    setHasCopiedKey(true)
    setTimeout(() => setHasCopiedKey(false), 2000)
  }
  
  return (
    <div className="min-h-screen persona-bg flex items-center justify-center p-4 overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 persona-gradient-animated opacity-70" />
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-500/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl" />
      </div>
      
      {/* Auth Card */}
      <div className="w-full max-w-md relative persona-glass rounded-2xl shadow-2xl persona-animate-scale">
        <div className="text-center space-y-4 p-6 pb-2">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <img 
                src="/logo.png" 
                alt="Chrona" 
                width={64}
                height={64}
                className="w-16 h-16 rounded-2xl shadow-lg shadow-teal-500/25 object-cover transform hover:scale-105 transition-transform"
                decoding="async"
              />
              <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <h1 className="text-3xl font-bold persona-gradient-text">Chrona</h1>
              <p className="text-slate-500 text-sm mt-1">Roleplay Universe</p>
            </div>
          </div>
          <p className="text-slate-300/50 text-sm">
            Create your identity. Meet real people. Roleplay your story.
          </p>
        </div>
        
        <div className="p-6 pt-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 persona-tabs mb-6 h-11">
              <TabsTrigger value="login" className="persona-tab data-[state=active]:persona-tab-active h-9 rounded-md transition-all">
                <LogIn className="w-4 h-4 mr-2" />Login
              </TabsTrigger>
              <TabsTrigger value="signup" className="persona-tab data-[state=active]:persona-tab-active h-9 rounded-md transition-all">
                <UserPlus className="w-4 h-4 mr-2" />Sign Up
              </TabsTrigger>
            </TabsList>
            
            {error && !showSecurityKeyModal && <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm persona-animate-in">{error}</div>}
            
            <TabsContent value="login" className="persona-animate-in">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username" className="text-slate-200/80">Username</Label>
                  <Input id="login-username" type="text" placeholder="cooluser123" value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} required className="persona-input h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-slate-200/80">Password</Label>
                  <Input id="login-password" type="password" placeholder="••••••••" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} required className="persona-input h-11" />
                </div>
                <button type="submit" className="btn-persona w-full h-11 text-base font-medium flex items-center justify-center" disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Logging in...</> : <><LogIn className="w-4 h-4 mr-2" />Login</>}
                </button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup" className="persona-animate-in">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-username" className="text-slate-200/80">Username</Label>
                  <Input id="signup-username" type="text" placeholder="cooluser123" value={signupForm.username} onChange={(e) => setSignupForm({ ...signupForm, username: e.target.value })} required className="persona-input h-11" />
                  <p className="text-xs text-slate-500">Letters, numbers, and underscores only. 3-20 characters.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-slate-200/80">Password</Label>
                  <Input id="signup-password" type="password" placeholder="••••••••" value={signupForm.password} onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })} required className="persona-input h-11" />
                  <p className="text-xs text-slate-500">At least 6 characters.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm" className="text-slate-200/80">Confirm Password</Label>
                  <Input id="signup-confirm" type="password" placeholder="••••••••" value={signupForm.confirmPassword} onChange={(e) => setSignupForm({ ...signupForm, confirmPassword: e.target.value })} required className="persona-input h-11" />
                </div>
                
                {/* Date of Birth */}
                <div className="space-y-2">
                  <Label className="text-slate-200/80 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-teal-400" />
                    Date of Birth
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <select
                        value={dob.day}
                        onChange={(e) => setDob({ ...dob, day: e.target.value })}
                        required
                        className="w-full h-11 px-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-slate-100 text-sm appearance-none cursor-pointer focus:outline-none focus:border-teal-500/30 focus:bg-white/[0.04] transition-all hover:border-white/[0.12]"
                      >
                        <option value="" className="bg-[#0f1117] text-slate-400">Day</option>
                        {Array.from({ length: 31 }, (_, i) => (
                          <option key={i + 1} value={i + 1} className="bg-[#0f1117] text-slate-100">{i + 1}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <select
                        value={dob.month}
                        onChange={(e) => setDob({ ...dob, month: e.target.value })}
                        required
                        className="w-full h-11 px-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-slate-100 text-sm appearance-none cursor-pointer focus:outline-none focus:border-teal-500/30 focus:bg-white/[0.04] transition-all hover:border-white/[0.12]"
                      >
                        <option value="" className="bg-[#0f1117] text-slate-400">Month</option>
                        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
                          <option key={i + 1} value={i + 1} className="bg-[#0f1117] text-slate-100">{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <select
                        value={dob.year}
                        onChange={(e) => setDob({ ...dob, year: e.target.value })}
                        required
                        className="w-full h-11 px-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-slate-100 text-sm appearance-none cursor-pointer focus:outline-none focus:border-teal-500/30 focus:bg-white/[0.04] transition-all hover:border-white/[0.12]"
                      >
                        <option value="" className="bg-[#0f1117] text-slate-400">Year</option>
                        {Array.from({ length: 100 }, (_, i) => {
                          const year = new Date().getFullYear() - 16 - i
                          return (
                            <option key={year} value={year} className="bg-[#0f1117] text-slate-100">{year}</option>
                          )
                        })}
                      </select>
                    </div>
                  </div>
                  {dobError && <p className="text-xs text-red-400 mt-1">{dobError}</p>}
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    You must be 16 or older. Your age helps keep the community safe.
                  </p>
                </div>
                
                <button type="submit" className="btn-persona w-full h-11 text-base font-medium flex items-center justify-center" disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account...</> : <><Zap className="w-4 h-4 mr-2" />Create Account</>}
                </button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      {/* Security Key Modal */}
      {showSecurityKeyModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-gradient-to-b from-[#0f1117] to-[#0b0d11] rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-white/[0.08] bg-gradient-to-r from-teal-900/30 to-cyan-900/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-400 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {isLoginFlow ? 'Security Verification' : 'Save Your Security Key'}
                  </h2>
                  <p className="text-sm text-slate-400">
                    {isLoginFlow ? 'Enter your security key to continue' : 'This key is required for every login'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Modal Content */}
            <div className="p-6">
              {!isLoginFlow ? (
                /* Show Security Key (First Time) */
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
                  <div className="bg-teal-900/30 rounded-xl p-4 border border-white/[0.08]">
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
                    className="btn-persona w-full h-11 text-base font-medium flex items-center justify-center gap-2"
                  >
                    I&apos;ve saved my key
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                /* Enter Security Key */
                <div className="space-y-4">
                  {error && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                      {error}
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label className="text-slate-200/80">Enter your security key</Label>
                    <Input 
                      type="text" 
                      placeholder="XXXX-XXXX-XXXX-XXXX" 
                      value={securityKeyInput}
                      onChange={(e) => setSecurityKeyInput(e.target.value.toUpperCase())}
                      className="persona-input h-12 text-center font-mono text-lg tracking-wider"
                      maxLength={19}
                    />
                    <p className="text-xs text-slate-500 text-center">
                      Enter the security key you saved during signup
                    </p>
                  </div>
                  
                  <button 
                    onClick={handleVerifySecurityKey}
                    disabled={securityKeyInput.length < 16 || isSubmitting}
                    className="btn-persona w-full h-11 text-base font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        Verify & Continue
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== MY PERSONAS MODAL ====================
function MyPersonasModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user } = useAuth()
  const userIsAdult = user?.dateOfBirth ? isAdult(new Date(user.dateOfBirth)) : false
  const { personas, activePersona, isLoading, activatePersona, deletePersona, createPersona, updatePersona } = usePersonas()
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [listingPersona, setListingPersona] = useState<Persona | null>(null)
  const [importedPersona, setImportedPersona] = useState<any | null>(null)
  const importFileRef = useRef<HTMLInputElement>(null)
  
  const handleActivate = async (id: string) => { try { await activatePersona(id) } catch (err) { console.error('Failed to activate:', err) } }
  const handleDelete = async (id: string) => { if (!confirm('Are you sure you want to delete this persona?')) return; setDeletingId(id); try { await deletePersona(id) } catch (err) { console.error('Failed to delete:', err) } finally { setDeletingId(null) } }

  // Export persona as JSON file
  const handleExport = (persona: Persona) => {
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      persona: {
        name: persona.name,
        avatarUrl: persona.avatarUrl,
        description: persona.description,
        archetype: persona.archetype,
        gender: persona.gender,
        pronouns: persona.pronouns,
        age: persona.age,
        tags: persona.tags || [],
        personalityDescription: persona.personalityDescription,
        personalitySpectrums: persona.personalitySpectrums || null,
        bigFive: persona.bigFive || null,
        hexaco: persona.hexaco || null,
        strengths: persona.strengths || [],
        flaws: persona.flaws || [],
        values: persona.values || [],
        fears: persona.fears || [],
        species: persona.species,
        likes: persona.likes || [],
        dislikes: persona.dislikes || [],
        hobbies: persona.hobbies || [],
        skills: persona.skills || [],
        languages: persona.languages || [],
        habits: persona.habits || [],
        speechPatterns: persona.speechPatterns || [],
        backstory: persona.backstory,
        appearance: persona.appearance,
        mbtiType: persona.mbtiType,
        themeEnabled: persona.themeEnabled ?? false,
        rpStyle: persona.rpStyle,
        rpPreferredGenders: persona.rpPreferredGenders || [],
        rpGenres: persona.rpGenres || [],
        rpLimits: persona.rpLimits || [],
        rpThemes: persona.rpThemes || [],
        rpExperienceLevel: persona.rpExperienceLevel,
        rpResponseTime: persona.rpResponseTime,
        nsfwEnabled: persona.nsfwEnabled ?? false,
        nsfwBodyType: persona.nsfwBodyType,
        nsfwKinks: persona.nsfwKinks || [],
        nsfwContentWarnings: persona.nsfwContentWarnings || [],
        nsfwOrientation: persona.nsfwOrientation,
        nsfwRolePreference: persona.nsfwRolePreference,
        connections: (persona.connections || []).map(c => ({
          characterName: c.characterName,
          relationshipType: c.relationshipType,
          specificRole: c.specificRole || null,
          characterAge: c.characterAge || null,
          description: c.description || null,
        })),
      }
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${persona.name.replace(/\s+/g, '_')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Import persona from JSON file
  const handleImport = () => {
    importFileRef.current?.click()
  }

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string)
        // Support both { persona: {...} } wrapper and bare persona objects
        const imported = json.persona || json
        setImportedPersona(imported)
        setShowCreateModal(true)
      } catch (err) {
        alert('Invalid persona file. Please make sure it\'s a valid JSON file.')
      }
    }
    reader.readAsText(file)
    // Reset file input so the same file can be re-imported
    e.target.value = ''
  }
  
  const handleSavePersona = async (data: PersonaFormData) => {
    if (editingPersona) {
      await updatePersona(editingPersona.id, data)
      setEditingPersona(null)
    } else {
      await createPersona(data)
      setShowCreateModal(false)
    }
  }
  
  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="persona-modal max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader className="persona-modal-header flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold persona-gradient-text flex items-center gap-2">
                <User className="w-5 h-5 text-slate-400" />
                My Characters
              </DialogTitle>
              <DialogDescription className="text-slate-500">
                Manage your character identities. Switch between characters to roleplay as different personas.
              </DialogDescription>
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto py-4 custom-scrollbar">
            {isLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-teal-500" /></div>
            ) : personas.length === 0 ? (
              <div className="persona-empty-state persona-card py-12">
                <div className="persona-empty-state-icon">
                  <User className="w-8 h-8" />
                </div>
                <p className="text-slate-200">You haven&apos;t created any characters yet.</p>
                <p className="text-slate-500 text-sm mt-1 mb-4">Create your first character or import one to start roleplaying!</p>
                <div className="flex items-center gap-3 justify-center">
                  <button onClick={() => setShowCreateModal(true)} className="btn-persona flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Create Character
                  </button>
                  <button onClick={handleImport} className="flex items-center gap-2 py-2 px-4 rounded-lg text-sm font-medium text-slate-400 bg-white/[0.02] border border-white/[0.06] hover:text-slate-200 hover:bg-white/[0.04] hover:border-white/[0.10] transition-all">
                    <Upload className="w-4 h-4" /> Import
                  </button>
                  <input ref={importFileRef} type="file" accept=".json" onChange={handleImportFileChange} className="hidden" />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {personas.map((persona) => (
                  <div key={persona.id} className={`persona-card persona-card-hover p-4 ${persona.isActive ? 'border-teal-500/25 bg-white/[0.03]' : ''}`}>
                    <div className="flex items-start gap-4">
                      <div className="relative">
                        <Avatar className="w-14 h-14 border-2 border-teal-500/20">
                          <AvatarImage src={persona.avatarUrl || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-teal-500 to-cyan-400 text-white text-lg font-semibold">{persona.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        {persona.isActive && (
                          <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-[#0f1117] flex items-center justify-center"><Check className="w-3 h-3 text-white" /></span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-100 truncate">{persona.name}</h3>
                          {persona.isActive && <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Active</span>}
                        </div>
                        {persona.description && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{persona.description}</p>}
                        {persona.archetype && <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs bg-teal-500/15 text-slate-300">{persona.archetype}</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        {!persona.isActive && (
                          <button onClick={() => handleActivate(persona.id)} className="btn-persona-ghost text-xs py-1.5 px-3 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Set Active
                          </button>
                        )}
                        <button onClick={() => setListingPersona(persona)} className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all" title="List on Marketplace">
                          <Store className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleExport(persona)} className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all" title="Export Character">
                          <Download className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingPersona(persona)} className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/[0.05] transition-all" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(persona.id)} disabled={deletingId === persona.id} className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50" title="Delete">
                          {deletingId === persona.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {personas.length > 0 && (
            <div className="pt-4 border-t border-white/[0.08] space-y-2">
              <button onClick={() => setShowCreateModal(true)} className="btn-persona w-full flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Create New Character
              </button>
              <button onClick={handleImport} className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium text-slate-400 bg-white/[0.02] border border-white/[0.06] hover:text-slate-200 hover:bg-white/[0.04] hover:border-white/[0.10] transition-all">
                <Upload className="w-4 h-4" /> Import Character
              </button>
              <input ref={importFileRef} type="file" accept=".json" onChange={handleImportFileChange} className="hidden" />
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      <ChunkErrorBoundary>
        <Suspense fallback={<ModalSkeleton />}>
          <PersonaForm 
            isOpen={showCreateModal || !!editingPersona} 
            onClose={() => { setShowCreateModal(false); setEditingPersona(null); setImportedPersona(null) }} 
            persona={editingPersona} 
            importedData={importedPersona}
            onSave={handleSavePersona}
            isUserAdult={userIsAdult}
          />
        </Suspense>
      </ChunkErrorBoundary>
      
      <Suspense fallback={null}>
        <ListOnMarketplaceModal
          isOpen={!!listingPersona}
          onClose={() => setListingPersona(null)}
          persona={listingPersona}
          onSuccess={() => setListingPersona(null)}
        />
      </Suspense>
    </>
  )
}

function TopBar() {
  const [isMaximized, setIsMaximized] = useState(false)

  const doAction = (action: 'minimize' | 'maximize' | 'close') => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      if (action === 'minimize') (window as any).electronAPI.minimizeWindow()
      if (action === 'maximize') {
        (window as any).electronAPI.maximizeWindow()
        setIsMaximized(prev => !prev)
      }
      if (action === 'close') (window as any).electronAPI.closeWindow()
    }
  }

  return (
    <div className="topbar h-9 w-full flex items-center justify-between px-3 bg-[#0f1117]/95 border-b border-white/[0.10] text-slate-100 backdrop-blur-lg -webkit-app-region-drag">
      <div className="flex items-center gap-3 text-sm font-semibold select-none">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-400 flex items-center justify-center shadow-[0_0_20px_rgba(20,184,166,0.3)]">
          <span className="text-xs font-black">C</span>
        </div>
        <div className="flex flex-col leading-3">
          <span className="text-sm text-slate-100">Chrona</span>
          <span className="text-[10px] text-slate-300">Roleplay Universe</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => doAction('minimize')} className="window-btn -webkit-app-region-no-drag" title="Minimize"><Minus className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => doAction('maximize')} className="window-btn -webkit-app-region-no-drag" title="Maximize">{isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}</button>
        <button type="button" onClick={() => doAction('close')} className="window-btn-red -webkit-app-region-no-drag" title="Close"><X className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  )
}

// ==================== CHAT VIEW ====================

// Memoized individual chat message component to prevent re-rendering all messages on hover
const ChatMessageItem = React.memo(function ChatMessageItem({
  message,
  showHeader,
  isMine,
  isHovered,
  otherUsername,
  onHoverEnter,
  onHoverLeave,
  onContextMenu,
  onViewImage,
  onMoreActions,
}: {
  message: ChatMessage
  showHeader: boolean
  isMine: boolean
  isHovered: boolean
  otherUsername: string
  onHoverEnter: () => void
  onHoverLeave: () => void
  onContextMenu: (e: React.MouseEvent, message: ChatMessage) => void
  onViewImage: (url: string) => void
  onMoreActions: (e: React.MouseEvent, message: ChatMessage) => void
}) {
  return (
    <div 
      className={`group relative flex gap-3 ${showHeader ? 'mt-4' : 'mt-0.5'} persona-message`}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
    >
      {/* Avatar column */}
      <div className="w-10 flex-shrink-0">
        {showHeader ? (
          <Avatar className="w-10 h-10 border border-teal-500/20">
            <AvatarImage src={message.sender.avatarUrl || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-teal-500/50 to-cyan-500/50 text-white text-sm font-medium">
              {message.sender.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="w-10 flex items-center justify-center">
            {isHovered && (
              <span className="text-[9px] text-slate-500">
                {new Date(message.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
          </div>
        )}
      </div>
      
      {/* Message content */}
      <div className="flex-1 min-w-0">
        {showHeader && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className={`font-semibold text-sm ${isMine ? 'text-teal-300' : 'text-slate-100'}`}>
              {message.sender.name}
            </span>
            {message.sender.isOfficial && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">OFFICIAL</span>
            )}
            <span className="text-[10px] text-slate-500">
              {new Date(message.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          </div>
        )}
        
        {/* Message body */}
        <div 
          className={`relative inline-block max-w-full ${!isMine ? 'cursor-pointer' : ''}`}
          onContextMenu={(e) => onContextMenu(e, message)}
        >
          {message.imageUrl && (
            <div className="mb-1.5">
              <img 
                src={message.imageUrl} 
                alt="Shared image" 
                className="max-w-[400px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity border border-white/[0.08] max-h-[350px] object-cover" 
                loading="lazy"
                decoding="async"
                width={400}
                height={350}
                onClick={() => onViewImage(message.imageUrl!)} 
              />
            </div>
          )}
          {message.content && (
            <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
              {parseMessageWithMarkdown(message.content, [otherUsername])}
            </div>
          )}
        </div>
      </div>
      
      {/* Hover actions - emoji reaction button */}
      {isHovered && (
        <div className="absolute -top-3 right-2 flex items-center gap-0.5 bg-[#1a1c22] border border-white/[0.1] rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
          <button
            className="w-7 h-7 flex items-center justify-center hover:bg-white/[0.08] rounded-md transition-colors text-slate-400 hover:text-slate-200"
            onClick={(e) => { e.stopPropagation() }}
            title="Add reaction"
          >
            <span className="text-xs">😄</span>
          </button>
          <button
            className="w-7 h-7 flex items-center justify-center hover:bg-white/[0.08] rounded-md transition-colors text-slate-400 hover:text-slate-200"
            onClick={(e) => onMoreActions(e, message)}
            title="More"
          >
            <span className="text-[10px]">•••</span>
          </button>
        </div>
      )}
    </div>
  )
})

// Maximum messages to render in the DOM at once (virtual scrolling limit)
const MAX_VISIBLE_MESSAGES = 150

function ChatView({ conversation, onBack }: { conversation: Conversation; onBack: () => void }) {
  const { user } = useAuth()
  const { activePersona, uploadAvatar } = usePersonas()
  
  // Check if this is a conversation with Blorp (read-only)
  const isBlorpConversation = conversation.otherPersona?.name === 'Blorp'
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [typingPersona, setTypingPersona] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [viewingImage, setViewingImage] = useState<string | null>(null) // Modal image viewer
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null)
  const [imageZoom, setImageZoom] = useState(false)
  const [showAllMessages, setShowAllMessages] = useState(false) // Virtual scrolling toggle
  
  // Report modal state
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportMessage, setReportMessage] = useState<ChatMessage | null>(null)
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; message: ChatMessage } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { toast } = useToast()
  
  // Virtual scrolling: only render recent messages to prevent DOM bloat
  const visibleMessages = useMemo(() => {
    if (showAllMessages || messages.length <= MAX_VISIBLE_MESSAGES) return messages
    return messages.slice(-MAX_VISIBLE_MESSAGES)
  }, [messages, showAllMessages])
  
  const hasMoreMessages = messages.length > MAX_VISIBLE_MESSAGES && !showAllMessages
  const hiddenMessageCount = messages.length - MAX_VISIBLE_MESSAGES
  
  // Memoized callbacks for ChatMessageItem
  const handleViewImage = useCallback((url: string) => {
    setViewingImage(url)
    setImageZoom(false)
  }, [])
  
  const handleContextMenu = useCallback((e: React.MouseEvent, message: ChatMessage) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, message })
  }, [])
  
  const handleMoreActions = useCallback((e: React.MouseEvent, message: ChatMessage) => {
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, message })
  }, [])
  
  const { isConnected, sendTyping } = useChat({
    conversationId: conversation.id,
    onNewMessage: (message) => {
      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) return prev
        return [...prev, message]
      })
    },
    onTyping: (data) => {
      setIsTyping(data.isTyping)
      setTypingPersona(data.isTyping ? data.personaName : null)
    }
  })
  
  useEffect(() => {
    async function fetchMessages() {
      try {
        const response = await fetch(`/api/conversations/${conversation.id}/messages`)
        if (response.ok) {
          const data = await response.json()
          setMessages(data.messages)
        }
      } catch (error) {
        console.error('Failed to fetch messages:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchMessages()
  }, [conversation.id])
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])
  
  const handleTyping = useCallback(() => {
    sendTyping(true)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => sendTyping(false), 3000)
  }, [sendTyping])
  
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { alert('Please select an image file'); return }
    if (file.size > 5 * 1024 * 1024) { alert('Image must be less than 5MB'); return }
    
    setIsUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/upload', { method: 'POST', body: formData })
      if (response.ok) {
        const data = await response.json()
        setImagePreview(data.avatarUrl || data.url)
      } else { alert('Failed to upload image') }
    } catch (error) {
      console.error('Image upload error:', error)
      alert('Failed to upload image')
    } finally {
      setIsUploadingImage(false)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }
  
  const sendMessage = async () => {
    if ((!newMessage.trim() && !imagePreview) || !activePersona || isSending) return

    const validMentions = extractMentions(newMessage.trim()).filter((username) => username === conversation.otherPersona?.username)

    setIsSending(true)
    try {
      const response = await fetch(`/api/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage.trim(), imageUrl: imagePreview, senderPersonaId: activePersona.id, mentions: validMentions })
      })
      if (response.ok) {
        const data = await response.json()
        setMessages(prev => [...prev, data.message])
        setNewMessage('')
        setImagePreview(null)
        sendTyping(false)
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsSending(false)
    }
  }
  
  // Generate AI response
  const generateAIResponse = async () => {
    if (!activePersona || isGenerating) return
    
    setIsGenerating(true)
    try {
      // Find messages that mention the current user
      const myUsername = activePersona.name
      const mentionRegex = new RegExp(`@${myUsername}\\b`, 'i')
      const mentionedIn = messages
        .filter(m => mentionRegex.test(m.content))
        .map(m => m.content)
        .pop() || null
      
      // Fetch the other persona's full data for better AI context
      let otherPersonaData = {
        name: conversation.otherPersona?.name || 'Unknown',
        description: conversation.otherPersona?.isOnline ? 'Online' : 'Offline',
      }
      
      try {
        const personaResponse = await fetch(`/api/personas/${conversation.otherPersona?.id}/public`)
        if (personaResponse.ok) {
          const personaResult = await personaResponse.json()
          if (personaResult.persona) {
            otherPersonaData = {
              name: personaResult.persona.name,
              description: personaResult.persona.description,
              backstory: personaResult.persona.backstory,
              personalityDescription: personaResult.persona.personalityDescription,
              personalitySpectrums: personaResult.persona.personalitySpectrums,
              bigFive: personaResult.persona.bigFive,
              hexaco: personaResult.persona.hexaco,
              strengths: personaResult.persona.strengths,
              flaws: personaResult.persona.flaws,
              values: personaResult.persona.values,
              fears: personaResult.persona.fears,
              likes: personaResult.persona.likes,
              dislikes: personaResult.persona.dislikes,
              hobbies: personaResult.persona.hobbies,
              speechPatterns: personaResult.persona.speechPatterns,
              mbtiType: personaResult.persona.mbtiType,
              gender: personaResult.persona.gender,
              age: personaResult.persona.age,
              species: personaResult.persona.species,
            }
          }
        }
      } catch (fetchError) {
        console.warn('Could not fetch other persona data, using basic info:', fetchError)
      }
      
      const response = await fetch('/api/ai/generate-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.slice(-15), // Last 15 messages for context
          myPersona: {
            name: activePersona.name,
            description: activePersona.description,
            backstory: activePersona.backstory,
            personalityDescription: activePersona.personalityDescription,
            personalitySpectrums: activePersona.personalitySpectrums,
            bigFive: activePersona.bigFive,
            hexaco: activePersona.hexaco,
            strengths: activePersona.strengths,
            flaws: activePersona.flaws,
            values: activePersona.values,
            fears: activePersona.fears,
            likes: activePersona.likes,
            dislikes: activePersona.dislikes,
            hobbies: activePersona.hobbies,
            speechPatterns: activePersona.speechPatterns,
            mbtiType: activePersona.mbtiType,
            gender: activePersona.gender,
            age: activePersona.age,
            species: activePersona.species,
          },
          otherPersona: otherPersonaData,
          mentionedIn,
        }),
      })
      
      const data = await response.json()
      
      if (response.ok && data.response) {
        setNewMessage(data.response)
        // Focus the textarea after generating
        setTimeout(() => {
          textareaRef.current?.focus()
        }, 0)
      } else {
        toast({ 
          title: 'Generation Failed', 
          description: data.error || 'Failed to generate response. Please try again.',
          variant: 'destructive' 
        })
      }
    } catch (error) {
      console.error('AI generation error:', error)
      toast({ 
        title: 'Generation Failed', 
        description: 'Network error. Please try again.',
        variant: 'destructive' 
      })
    } finally {
      setIsGenerating(false)
    }
  }
  
  // Handle keyboard shortcuts for markdown formatting
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send message on Enter (without shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
      return
    }
    
    // Markdown shortcuts
    if (e.ctrlKey || e.metaKey) {
      const textarea = textareaRef.current
      if (!textarea) return
      
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const hasSelection = start !== end
      
      switch (e.key.toLowerCase()) {
        case 'b': // Bold
          e.preventDefault()
          if (hasSelection) {
            const result = wrapSelection(newMessage, start, end, '**')
            setNewMessage(result.text)
            setTimeout(() => {
              textarea.setSelectionRange(result.cursorOffset - 2, result.cursorOffset - 2)
            }, 0)
          } else {
            setNewMessage(prev => prev + '****')
            setTimeout(() => {
              textarea.setSelectionRange(newMessage.length + 2, newMessage.length + 2)
            }, 0)
          }
          break
          
        case 'i': // Italic
          e.preventDefault()
          if (hasSelection) {
            const result = wrapSelection(newMessage, start, end, '*')
            setNewMessage(result.text)
            setTimeout(() => {
              textarea.setSelectionRange(result.cursorOffset - 1, result.cursorOffset - 1)
            }, 0)
          } else {
            setNewMessage(prev => prev + '**')
            setTimeout(() => {
              textarea.setSelectionRange(newMessage.length + 1, newMessage.length + 1)
            }, 0)
          }
          break
          
        case 'u': // Underline
          e.preventDefault()
          if (hasSelection) {
            const result = wrapSelection(newMessage, start, end, '__')
            setNewMessage(result.text)
            setTimeout(() => {
              textarea.setSelectionRange(result.cursorOffset - 2, result.cursorOffset - 2)
            }, 0)
          } else {
            setNewMessage(prev => prev + '____')
            setTimeout(() => {
              textarea.setSelectionRange(newMessage.length + 2, newMessage.length + 2)
            }, 0)
          }
          break
          
        case 's': // Strikethrough
          e.preventDefault()
          if (hasSelection) {
            const result = wrapSelection(newMessage, start, end, '~~')
            setNewMessage(result.text)
            setTimeout(() => {
              textarea.setSelectionRange(result.cursorOffset - 2, result.cursorOffset - 2)
            }, 0)
          } else {
            setNewMessage(prev => prev + '~~~~')
            setTimeout(() => {
              textarea.setSelectionRange(newMessage.length + 2, newMessage.length + 2)
            }, 0)
          }
          break
          
        case 'e': // Inline code
          e.preventDefault()
          if (hasSelection) {
            const result = wrapSelection(newMessage, start, end, '`')
            setNewMessage(result.text)
            setTimeout(() => {
              textarea.setSelectionRange(result.cursorOffset - 1, result.cursorOffset - 1)
            }, 0)
          } else {
            setNewMessage(prev => prev + '``')
            setTimeout(() => {
              textarea.setSelectionRange(newMessage.length + 1, newMessage.length + 1)
            }, 0)
          }
          break
      }
    }
  }
  
  return (
    <div className="flex flex-col h-full w-full min-h-0 bg-gradient-to-b from-[#0b0d11] via-[#0f1117] to-[#0e1015]">
      {/* Chat Header */}
      <div className="flex items-center gap-3 p-4 border-b border-white/[0.08] bg-[#0e1015]/50 backdrop-blur-sm sticky top-0 z-10">
        <Button variant="ghost" onClick={onBack} className="text-slate-300 hover:text-slate-100 hover:bg-white/[0.05] gap-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Back</span>
        </Button>
        <div className="w-px h-8 bg-teal-500/15" />
        <div className="relative persona-status" style={conversation.otherPersona?.isOnline ? {} : {}}>
          <Avatar className="w-10 h-10 border-2 border-teal-500/20">
            <AvatarImage src={conversation.otherPersona?.avatarUrl || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-teal-500/50 to-cyan-500/50 text-white font-semibold">{conversation.otherPersona?.name?.charAt(0) || '?'}</AvatarFallback>
          </Avatar>
          <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0e1015] ${conversation.otherPersona?.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-slate-100">{conversation.otherPersona?.name || 'Unknown'}</h3>
          <p className="text-xs text-slate-500">@{conversation.otherPersona?.username || 'unknown'}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08]">
          <span className={`w-2 h-2 rounded-full ${conversation.otherPersona?.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
          <span className={`text-xs font-medium ${conversation.otherPersona?.isOnline ? 'text-emerald-400' : 'text-slate-500'}`}>{conversation.otherPersona?.isOnline ? 'Online' : 'Offline'}</span>
        </div>
      </div>
      
      {/* Messages */}
      <ScrollArea className="flex-1 p-4 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-teal-500" /></div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <div className="w-20 h-20 rounded-full bg-white/[0.05] flex items-center justify-center mb-4 border border-white/[0.08]"><MessageCircle className="w-10 h-10" /></div>
            <p className="text-lg font-medium text-slate-200">Start the conversation!</p>
            <p className="text-sm mt-1 text-slate-500">Say hello to {conversation.otherPersona?.name || 'Unknown'}</p>
          </div>
        ) : (
          <div className="space-y-0 pb-4 max-w-[1100px] mx-auto w-full">
            {/* Load earlier messages button (virtual scrolling) */}
            {hasMoreMessages && (
              <div className="flex justify-center my-4">
                <button
                  onClick={() => setShowAllMessages(true)}
                  className="px-4 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-slate-400 hover:text-slate-200 hover:bg-white/[0.08] hover:border-teal-500/25 transition-all flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Load {hiddenMessageCount} earlier message{hiddenMessageCount !== 1 ? 's' : ''}
                </button>
              </div>
            )}
            {(() => {
              // Helper to format date separator
              const formatDateSeparator = (date: Date) => {
                const now = new Date()
                const yesterday = new Date(now)
                yesterday.setDate(yesterday.getDate() - 1)
                
                if (date.toDateString() === now.toDateString()) return 'Today'
                if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
                return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
              }
              
              // Check if two dates are on different days
              const isDifferentDay = (d1: Date, d2: Date) => {
                return d1.getFullYear() !== d2.getFullYear() || d1.getMonth() !== d2.getMonth() || d1.getDate() !== d2.getDate()
              }
              
              // Check if two timestamps are more than 7 minutes apart
              const isFarApart = (d1: Date, d2: Date) => {
                return Math.abs(d1.getTime() - d2.getTime()) > 7 * 60 * 1000
              }
              
              // Build message list with date separators and grouping (using visibleMessages for virtual scrolling)
              type MessageItem = 
                | { type: 'date'; date: Date; key: string }
                | { type: 'message'; message: ChatMessage; showHeader: boolean; key: string }
              
              const items: MessageItem[] = []
              
              visibleMessages.forEach((message, index) => {
                const messageDate = new Date(message.createdAt)
                const prevMessage = index > 0 ? visibleMessages[index - 1] : null
                const prevDate = prevMessage ? new Date(prevMessage.createdAt) : null
                
                // Add date separator if needed
                if (!prevDate || isDifferentDay(prevDate, messageDate)) {
                  items.push({ type: 'date', date: messageDate, key: `date-${message.id}` })
                }
                
                // Determine if we should show the header (avatar + name + timestamp)
                const sameSender = prevMessage && prevMessage.senderId === message.senderId
                const farApart = !prevDate || isFarApart(prevDate, messageDate)
                const showHeader = !sameSender || farApart
                
                items.push({ type: 'message', message, showHeader, key: message.id })
              })
              
              return items.map((item) => {
                if (item.type === 'date') {
                  return (
                    <div key={item.key} className="flex items-center my-4">
                      <div className="flex-1 h-px bg-white/[0.06]" />
                      <span className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        {formatDateSeparator(item.date)}
                      </span>
                      <div className="flex-1 h-px bg-white/[0.06]" />
                    </div>
                  )
                }
                
                const { message, showHeader } = item
                const isMine = message.senderId === activePersona?.id
                const isHovered = hoveredMessageId === message.id
                
                return (
                  <ChatMessageItem
                    key={item.key}
                    message={message}
                    showHeader={showHeader}
                    isMine={isMine}
                    isHovered={isHovered}
                    otherUsername={conversation.otherPersona?.username || ''}
                    onHoverEnter={() => setHoveredMessageId(message.id)}
                    onHoverLeave={() => setHoveredMessageId(null)}
                    onContextMenu={handleContextMenu}
                    onViewImage={handleViewImage}
                    onMoreActions={handleMoreActions}
                  />
                )
              })
            })()}
            {isTyping && (
              <div className="flex items-center gap-3 mt-4 persona-message">
                <Avatar className="w-10 h-10 border border-teal-500/20">
                  <AvatarFallback className="bg-gradient-to-br from-teal-500/50 to-cyan-500/50 text-white text-sm font-medium">
                    {typingPersona?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-semibold text-sm text-slate-100 mb-0.5">{typingPersona}</span>
                  <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1a1c22] border border-white/[0.06]">
                    <div className="flex gap-1 items-center">
                      <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDuration: '0.6s', animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDuration: '0.6s', animationDelay: '0.15s' }} />
                      <span className="w-2 h-2 bg-teal-300 rounded-full animate-bounce" style={{ animationDuration: '0.6s', animationDelay: '0.3s' }} />
                    </div>
                    <span className="text-[10px] text-slate-500 ml-1.5">typing</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>
      
      {/* Message Input */}
      <div className="sticky bottom-0 p-4 border-t border-white/[0.08] bg-[#0e1015]/80 backdrop-blur-sm">
        {isBlorpConversation ? (
          /* Read-only message for Blorp conversations */
          <div className="max-w-3xl mx-auto">
            <div className="text-center py-4 px-6 persona-card rounded-xl border border-amber-500/20 bg-amber-500/5">
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-400 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-white" />
                </div>
                <p className="text-amber-300 font-medium">Official Notification Channel</p>
              </div>
              <p className="text-sm text-slate-400">This is a read-only conversation. You can only view messages from Blorp, not reply.</p>
            </div>
          </div>
        ) : !activePersona ? (
          <div className="text-center py-3 persona-card rounded-xl"><p className="text-slate-500 text-sm">Create and activate a persona to send messages</p></div>
        ) : (
          <div className="max-w-3xl mx-auto">
            {imagePreview && (
              <div className="mb-3 relative inline-block">
                <img src={imagePreview} alt="Preview" className="max-h-32 rounded-lg border border-teal-500/20" />
                <button onClick={() => setImagePreview(null)} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-400 transition-colors shadow-lg"><X className="w-4 h-4" /></button>
              </div>
            )}
            {/* Markdown Toolbar */}
            <div className="flex items-center gap-1 mb-2 px-1">
              {[
                { syntax: '**', label: 'B', title: 'Bold (Ctrl+B)', className: 'font-bold text-xs' },
                { syntax: '*', label: 'I', title: 'Italic (Ctrl+I)', className: 'italic text-xs' },
                { syntax: '__', label: 'U', title: 'Underline (Ctrl+U)', className: 'underline text-xs' },
                { syntax: '~~', label: 'S', title: 'Strikethrough', className: 'line-through text-xs' },
                { syntax: '`', label: '</>', title: 'Inline Code', className: 'font-mono text-[10px]' },
              ].map((btn) => (
                <button
                  key={btn.syntax}
                  onClick={() => {
                    const textarea = textareaRef.current
                    if (!textarea) return
                    const start = textarea.selectionStart
                    const end = textarea.selectionEnd
                    const result = wrapSelection(newMessage, start, end, btn.syntax)
                    setNewMessage(result.text)
                    setTimeout(() => {
                      textarea.focus()
                      textarea.setSelectionRange(result.cursorOffset - btn.syntax.length, result.cursorOffset - btn.syntax.length)
                    }, 0)
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] transition-colors"
                  title={btn.title}
                >
                  <span className={btn.className}>{btn.label}</span>
                </button>
              ))}
              <div className="w-px h-4 bg-white/[0.08] mx-1" />
              {[
                { syntax: '||', label: '⬛', title: 'Spoiler' },
                { syntax: '```', label: '{ }', title: 'Code Block' },
              ].map((btn) => (
                <button
                  key={btn.syntax}
                  onClick={() => {
                    const textarea = textareaRef.current
                    if (!textarea) return
                    const start = textarea.selectionStart
                    const end = textarea.selectionEnd
                    const result = wrapSelection(newMessage, start, end, btn.syntax)
                    setNewMessage(result.text)
                    setTimeout(() => {
                      textarea.focus()
                      textarea.setSelectionRange(result.cursorOffset - 2, result.cursorOffset - 2)
                    }, 0)
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] transition-colors text-[10px]"
                  title={btn.title}
                >
                  {btn.label}
                </button>
              ))}
            </div>
            <div className="flex gap-3 items-center">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
              <Button type="button" variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isUploadingImage || isSending} className="text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] rounded-xl h-11 w-11 flex-shrink-0 border border-white/[0.08]">
                {isUploadingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
              </Button>
              <div className="flex-1 relative">
                <Textarea 
                  ref={textareaRef}
                  placeholder="Type a message..." 
                  value={newMessage} 
                  onChange={(e) => { setNewMessage(e.target.value); handleTyping() }} 
                  onKeyDown={handleKeyDown} 
                  className="w-full persona-input resize-none h-11 min-h-[44px] max-h-[120px] rounded-xl py-2.5 px-4" 
                  disabled={isSending} 
                />
              </div>
              {/* AI Generate Button */}
              <Button 
                onClick={generateAIResponse} 
                disabled={!activePersona || isGenerating || isSending} 
                className="btn-persona h-11 w-11 rounded-xl flex-shrink-0 px-0"
                title="Generate AI response based on your persona"
              >
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              </Button>
              <Button onClick={sendMessage} disabled={(!newMessage.trim() && !imagePreview) || isSending} className="btn-persona h-11 w-11 rounded-xl flex-shrink-0 px-0">
                {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Image Preview Modal - Gallery-style with zoom */}
      {viewingImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4"
          onClick={() => { setViewingImage(null); setImageZoom(false) }}
        >
          <button 
            onClick={() => { setViewingImage(null); setImageZoom(false) }}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors z-10"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          {/* Zoom toggle button */}
          <button
            onClick={(e) => { e.stopPropagation(); setImageZoom(!imageZoom) }}
            className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors z-10"
            title={imageZoom ? 'Fit to screen' : 'Zoom to actual size'}
          >
            <Maximize2 className="w-5 h-5 text-white" />
          </button>
          <img 
            src={viewingImage} 
            alt="Full size image" 
            className={`rounded-lg shadow-2xl transition-all duration-300 cursor-zoom-in ${
              imageZoom 
                ? 'max-w-none max-h-none object-none' 
                : 'max-w-full max-h-full object-contain'
            }`}
            style={imageZoom ? { width: 'auto', height: 'auto' } : {}}
            onClick={(e) => { e.stopPropagation(); setImageZoom(!imageZoom) }}
          />
          <a 
            href={viewingImage} 
            target="_blank" 
            rel="noopener noreferrer"
            className="absolute bottom-4 right-4 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm flex items-center gap-2 transition-colors z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <span>Open in new tab</span>
            <span className="text-white/60">↗</span>
          </a>
        </div>
      )}
      
      {/* Context Menu for Messages */}
      {contextMenu && (
        <div 
          className="fixed inset-0 z-50"
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu(null) }}
        >
          <div 
            className="fixed bg-[#0e1015] border border-teal-500/20 rounded-lg shadow-xl py-1 min-w-[150px] z-50"
            style={{ 
              left: `${Math.min(contextMenu.x, window.innerWidth - 170)}px`, 
              top: `${Math.min(contextMenu.y, window.innerHeight - 100)}px` 
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setReportMessage(contextMenu.message)
                setShowReportModal(true)
                setContextMenu(null)
              }}
              className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors rounded-lg mx-1"
            >
              <Flag className="w-4 h-4" />
              Report Message
            </button>
          </div>
        </div>
      )}
      
      {/* Report Modal */}
      <Suspense fallback={null}>
        <ReportModal
          isOpen={showReportModal}
          onClose={() => { setShowReportModal(false); setReportMessage(null) }}
          type="dm_message"
          reportedId={conversation.otherPersona?.id || ''}
          referenceId={reportMessage?.id}
          reportedName={conversation.otherPersona?.name || 'Unknown'}
          messagePreview={reportMessage?.content || undefined}
        />
      </Suspense>
    </div>
  )
}

// ==================== DM REQUEST DIALOG ====================
export function DmRequestDialog({
  isOpen,
  onClose,
  targetPersona,
  myPersona,
  onSuccess
}: {
  isOpen: boolean
  onClose: () => void
  targetPersona: { id: string; name: string; username: string } | null
  myPersona: Persona | null
  onSuccess: (conversationId: string) => void
}) {
  const [firstMessage, setFirstMessage] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast({ title: 'Invalid file', description: 'Please select an image file', variant: 'destructive' }); return }
    if (file.size > 5 * 1024 * 1024) { toast({ title: 'File too large', description: 'Image must be less than 5MB', variant: 'destructive' }); return }
    
    setIsUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/upload', { method: 'POST', body: formData })
      if (response.ok) {
        const data = await response.json()
        setImageUrl(data.avatarUrl || data.url)
      } else { toast({ title: 'Upload failed', description: 'Failed to upload image', variant: 'destructive' }) }
    } catch (error) {
      console.error('Image upload error:', error)
      toast({ title: 'Upload failed', description: 'Failed to upload image', variant: 'destructive' })
    } finally {
      setIsUploadingImage(false)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSendRequest = async () => {
    if (!targetPersona || !myPersona) return
    if (!firstMessage.trim() && !imageUrl) {
      toast({ title: 'Message required', description: 'Please enter a message or add an image', variant: 'destructive' })
      return
    }

    setIsSending(true)
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetPersonaId: targetPersona.id,
          myPersonaId: myPersona.id,
          firstMessage: firstMessage.trim(),
          imageUrl
        })
      })
      const data = await response.json()

      if (response.ok) {
        if (data.conversation) {
          // Conversation was created (reverse DM request accepted or existing)
          onSuccess(data.conversation.id)
        } else if (data.dmRequest) {
          // DM request was sent
          toast({ title: 'Request sent!', description: `Your message request has been sent to ${targetPersona.name}`, variant: 'default' })
          onClose()
        }
        setFirstMessage('')
        setImageUrl(null)
      } else {
        toast({ title: 'Failed to send request', description: data.error || 'Something went wrong', variant: 'destructive' })
      }
    } catch (error) {
      console.error('Failed to send DM request:', error)
      toast({ title: 'Failed to send request', description: 'Network error. Please try again.', variant: 'destructive' })
    } finally {
      setIsSending(false)
    }
  }

  if (!isOpen || !targetPersona) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="persona-modal max-w-md">
        <DialogHeader className="persona-modal-header">
          <DialogTitle className="text-lg font-bold persona-gradient-text flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-slate-400" />
            Send Message Request
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            Start a conversation with {targetPersona.name}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.05] border border-white/[0.08]">
            <Avatar className="w-10 h-10 border-2 border-teal-500/20">
              <AvatarFallback className="bg-gradient-to-br from-teal-500 to-cyan-400 text-white font-semibold">
                {targetPersona.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-slate-100">{targetPersona.name}</p>
              <p className="text-xs text-slate-500">@{targetPersona.username}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-200/80">Your message</Label>
            <Textarea
              value={firstMessage}
              onChange={(e) => setFirstMessage(e.target.value)}
              placeholder="Write a message to start the conversation..."
              className="persona-input min-h-[100px] resize-none"
              maxLength={500}
            />
            <p className="text-xs text-slate-500 text-right">{firstMessage.length}/500</p>
          </div>

          {/* Image upload */}
          <div className="space-y-2">
            <Label className="text-slate-200/80">Add image (optional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            {imageUrl ? (
              <div className="relative rounded-lg overflow-hidden border border-white/[0.08]">
                <img src={imageUrl} alt="Preview" className="w-full max-h-40 object-cover" />
                <button
                  onClick={() => setImageUrl(null)}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingImage}
                className="w-full py-3 rounded-lg border border-dashed border-teal-500/20 text-slate-400 hover:border-teal-500/30 hover:text-slate-300 transition-colors flex items-center justify-center gap-2"
              >
                {isUploadingImage ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                ) : (
                  <><ImageIcon className="w-4 h-4" /> Click to add image</>
                )}
              </button>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-white/[0.08] text-slate-300 hover:bg-white/[0.05] transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSendRequest}
              disabled={isSending || (!firstMessage.trim() && !imageUrl)}
              className="btn-persona flex-1 py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
              ) : (
                <><Send className="w-4 h-4" /> Send Request</>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ==================== HOME PAGE (Discovery) ====================
function HomePageContent({ onStartChat, onNavigate, onOpenEditProfile, onOpenMyPersonas, navigationMode }: { onStartChat: (conv: Conversation) => void; onNavigate?: (item: string) => void; onOpenEditProfile?: () => void; onOpenMyPersonas?: () => void; navigationMode?: 'static' | 'linear' }) {
  const { user } = useAuth()
  const userIsAdult = user?.dateOfBirth ? isAdult(new Date(user.dateOfBirth)) : false
  const { personas, activePersona, isLoading: personasLoading, createPersona } = usePersonas()
  const { toast } = useToast()
  const accent = useVariantAccent()
  const [activeFilter, setActiveFilter] = useState('new')
  const [showOffline, setShowOffline] = useState(false)
  const [showPersonasModal, setShowPersonasModal] = useState(false)
  const [showCreatePersonaModal, setShowCreatePersonaModal] = useState(false)
  const [onlinePersonas, setOnlinePersonas] = useState<OnlinePersona[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoadingDiscovery, setIsLoadingDiscovery] = useState(true)
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [selectedPersona, setSelectedPersona] = useState<OnlinePersona | null>(null)
  const [archetypeFilter, setArchetypeFilter] = useState<string>('all')
  
  // Listen for events to open personas modal from topbar dropdown
  useEffect(() => {
    const handleShowPersonasModal = () => {
      setShowPersonasModal(true)
    }
    window.addEventListener('chrona:show-personas-modal', handleShowPersonasModal)
    return () => window.removeEventListener('chrona:show-personas-modal', handleShowPersonasModal)
  }, [])
  
  // Search filters state
  const [searchFilters, setSearchFilters] = useState<{
    query: string
    searchIn: string[]
    mbti: string[]
    gender: string[]
    ageMin: number | null
    ageMax: number | null
    species: string[]
    archetype: string[]
    tags: string[]
    attributes: string[]
    likes: string[]
    hobbies: string[]
    skills: string[]
    syncPersonality: boolean
  }>({
    query: '',
    searchIn: ['all'],
    mbti: [],
    gender: [],
    ageMin: null,
    ageMax: null,
    species: [],
    archetype: [],
    tags: [],
    attributes: [],
    likes: [],
    hobbies: [],
    skills: [],
    syncPersonality: false
  })
  
  // DM Request Dialog state
  const [showDmRequestDialog, setShowDmRequestDialog] = useState(false)
  const [dmRequestTarget, setDmRequestTarget] = useState<{ id: string; name: string; username: string } | null>(null)
  
  // Build search URL with filters
  const buildSearchUrl = useCallback(() => {
    const params = new URLSearchParams()
    params.set('filter', activeFilter)
    params.set('showOffline', showOffline.toString())
    
    if (searchFilters.query) params.set('q', searchFilters.query)
    if (searchFilters.searchIn.length > 0 && !searchFilters.searchIn.includes('all')) {
      params.set('searchIn', searchFilters.searchIn.join(','))
    }
    if (searchFilters.mbti.length > 0) params.set('mbti', searchFilters.mbti.join(','))
    if (searchFilters.gender.length > 0) params.set('gender', searchFilters.gender.join(','))
    if (searchFilters.ageMin !== null) params.set('ageMin', searchFilters.ageMin.toString())
    if (searchFilters.ageMax !== null) params.set('ageMax', searchFilters.ageMax.toString())
    if (searchFilters.species.length > 0) params.set('species', searchFilters.species.join(','))
    if (searchFilters.archetype.length > 0) params.set('archetype', searchFilters.archetype.join(','))
    if (archetypeFilter !== 'all') params.set('archetype', archetypeFilter)
    if (searchFilters.tags.length > 0) params.set('tags', searchFilters.tags.join(','))
    if (searchFilters.attributes.length > 0) params.set('attributes', searchFilters.attributes.join(','))
    if (searchFilters.likes.length > 0) params.set('likes', searchFilters.likes.join(','))
    if (searchFilters.hobbies.length > 0) params.set('hobbies', searchFilters.hobbies.join(','))
    if (searchFilters.skills.length > 0) params.set('skills', searchFilters.skills.join(','))
    if (searchFilters.syncPersonality) params.set('syncPersonality', 'true')
    
    return `/api/discovery?${params.toString()}`
  }, [activeFilter, showOffline, searchFilters, archetypeFilter])
  
  useEffect(() => {
    async function fetchDiscovery() {
      setIsLoadingDiscovery(true)
      try {
        const response = await apiFetch(buildSearchUrl())
        if (response.ok) {
          const data = await response.json()
          setOnlinePersonas(data.personas)
        }
      } catch (error) {
        console.error('Failed to fetch discovery:', error)
      } finally {
        setIsLoadingDiscovery(false)
      }
    }
    fetchDiscovery()
  }, [buildSearchUrl])
  
  useEffect(() => {
    async function fetchConversations() {
      try {
        const response = await fetch('/api/conversations')
        if (response.ok) {
          const data = await response.json()
          setConversations(data.conversations)
        }
      } catch (error) {
        console.error('Failed to fetch conversations:', error)
      } finally {
        setIsLoadingConversations(false)
      }
    }
    if (personas.length > 0) fetchConversations()
  }, [personas.length])
  
  const startConversation = useCallback(async (targetPersonaId: string) => {
    if (!activePersona) {
      toast({ title: 'No Active Character', description: 'Please create and activate a character first!', variant: 'destructive' })
      return
    }
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPersonaId, myPersonaId: activePersona.id })
      })
      const data = await response.json()
      
      if (response.ok) {
        // Check if we need to show DM request dialog
        if (data.needsDmRequest && data.targetPersona) {
          setDmRequestTarget(data.targetPersona)
          setShowDmRequestDialog(true)
          return
        }
        
        // Check if conversation was created
        if (data.conversation) {
          const convResponse = await fetch('/api/conversations')
          if (convResponse.ok) {
            const convData = await convResponse.json()
            setConversations(convData.conversations)
            const newConv = convData.conversations.find((c: Conversation) => c.id === data.conversation.id)
            if (newConv) {
              onStartChat(newConv)
              // Refresh DM sidebar
              window.dispatchEvent(new CustomEvent(DM_REFRESH_EVENT))
            }
          }
        } else if (data.dmRequest) {
          // DM request was sent successfully
          toast({ title: 'Request sent!', description: 'Your message request has been sent', variant: 'default' })
        }
      } else {
        toast({ title: 'Failed to Start Conversation', description: data.error || 'Something went wrong', variant: 'destructive' })
      }
    } catch (error) {
      console.error('Failed to start conversation:', error)
      toast({ title: 'Failed to Start Conversation', description: 'Network error. Please try again.', variant: 'destructive' })
    }
  }, [activePersona, toast, onStartChat])
  
  // Handle successful DM request (when conversation is created)
  const handleDmRequestSuccess = useCallback(async (conversationId: string) => {
    setShowDmRequestDialog(false)
    setDmRequestTarget(null)
    const convResponse = await fetch('/api/conversations')
    if (convResponse.ok) {
      const convData = await convResponse.json()
      setConversations(convData.conversations)
      const newConv = convData.conversations.find((c: Conversation) => c.id === conversationId)
      if (newConv) {
        onStartChat(newConv)
        // Refresh DM sidebar
        window.dispatchEvent(new CustomEvent(DM_REFRESH_EVENT))
      }
    }
  }, [onStartChat])
  
  const handleSavePersona = useCallback(async (data: PersonaFormData) => {
    await createPersona(data)
    setShowCreatePersonaModal(false)
  }, [createPersona])
  
  return (
    <div className="flex flex-col h-full min-h-0 persona-bg">
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {/* Featured Storylines Banner (includes topbar inside it) */}
        <FeaturedStorylinesBanner onNavigate={onNavigate} onOpenEditProfile={onOpenEditProfile} onOpenMyPersonas={onOpenMyPersonas} navigationMode={navigationMode} />

        <div className="p-4 pt-3">
        {/* Header row with My Characters button */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${accent.from} ${accent.to} flex items-center justify-center`}>
              <Users className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold text-slate-100">Discover</span>
          </div>
          <button onClick={() => setShowPersonasModal(true)} className="btn-persona flex items-center gap-2 text-sm py-2">
            <User className="w-4 h-4" /> My Characters
          </button>
        </div>

        {/* No Persona Warning */}
        {!personasLoading && personas.length === 0 && (
          <div className="persona-card persona-card-hover mb-6 p-4">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${accent.fromSubtle} ${accent.toSubtle} flex items-center justify-center border border-white/[0.08]`}>
                <User className="w-6 h-6 text-slate-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-100">Create Your First Character</h3>
                <p className="text-slate-500 text-sm">You need a character to start chatting!</p>
              </div>
              <button onClick={() => setShowCreatePersonaModal(true)} className="btn-persona flex items-center gap-2">
                <Plus className="w-4 h-4" /> Create
              </button>
            </div>
          </div>
        )}
        
        {/* Advanced Search */}
        <div className="mb-4">
          <Suspense fallback={<Skeleton className="h-10 w-full rounded-lg" />}>
            <AdvancedSearch 
              onSearch={(filters) => setSearchFilters(filters)}
              isLoading={isLoadingDiscovery}
            />
          </Suspense>
        </div>
        
        {/* Filter Tabs */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="persona-tabs inline-flex">
              {['new', 'following', 'followers'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`persona-tab ${activeFilter === filter ? 'persona-tab-active' : ''}`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
            
            {/* Archetype Dropdown Filter */}
            <select
              value={archetypeFilter}
              onChange={(e) => setArchetypeFilter(e.target.value)}
              className={`${accent.bgSurface} border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:${accent.ringFocus} appearance-none cursor-pointer hover:${accent.borderSubtle} transition-colors`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%235bb8d4' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.5rem center',
                backgroundSize: '0.875rem',
                paddingRight: '2rem',
              }}
            >
              <option value="all">All Archetypes</option>
              <option value="Hero">⚔️ Hero</option>
              <option value="Villain">💀 Villain</option>
              <option value="Mentor">🧙 Mentor</option>
              <option value="Lover">💕 Lover</option>
              <option value="Explorer">🗺️ Explorer</option>
              <option value="Creator">🎨 Creator</option>
              <option value="Rebel">🔥 Rebel</option>
              <option value="Trickster">🃏 Trickster</option>
              <option value="Caregiver">💝 Caregiver</option>
              <option value="Sage">📚 Sage</option>
              <option value="Ruler">👑 Ruler</option>
              <option value="Innocent">🌸 Innocent</option>
              <option value="Everyman">👤 Everyman</option>
              <option value="Sidekick">🤝 Sidekick</option>
              <option value="Antihero">🦹 Antihero</option>
            </select>
          </div>
          
          {/* Show Offline Toggle */}
          <button
            onClick={() => setShowOffline(!showOffline)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
              showOffline 
                ? `${accent.bgTint} border ${accent.borderSubtle} text-slate-200` 
                : `bg-white/[0.03] border border-white/[0.08] text-slate-400 hover:${accent.borderSubtle}`
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${showOffline ? accent.text.replace('text-', 'bg-') : 'bg-emerald-400 animate-pulse'}`} />
            {showOffline ? 'All Users' : 'Online Only'}
          </button>
        </div>
        
        <p className="text-sm text-slate-500 mb-4 flex items-center gap-2 flex-wrap">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${showOffline ? accent.text.replace('text-', 'bg-') : 'bg-emerald-400 animate-pulse'}`} />
          <span>{showOffline ? 'Showing all personas (online and offline)' : 'Showing personas that are currently online'}</span>
          {archetypeFilter !== 'all' && (
            <span className={`${accent.text} text-xs`}>• Filtered: {archetypeFilter}</span>
          )}
        </p>
        
        {/* Featured Section - top 3 personas with special styling */}
        {!isLoadingDiscovery && onlinePersonas.length > 3 && (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Featured</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-amber-500/20 to-transparent" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {onlinePersonas.slice(0, 3).map((persona, index) => (
                <div
                  key={`featured-${persona.id}`}
                  onClick={() => setSelectedPersona(persona)}
                  className="group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-500 hover:scale-[1.02] hover:shadow-xl hover:shadow-amber-500/10"
                >
                  {/* Featured border glow */}
                  <div className={`absolute inset-0 rounded-xl bg-gradient-to-br from-amber-500/15 via-transparent ${accent.toSubtle} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <div className={`relative ${accent.bgSurface} rounded-xl border border-amber-500/15 group-hover:border-amber-500/30 overflow-hidden`}>
                    {/* Mini banner + avatar row */}
                    <div className="flex items-center gap-3 p-3">
                      <div className="relative flex-shrink-0">
                        <Avatar className="w-10 h-10 border-2 border-amber-500/30">
                          <AvatarImage src={persona.avatarUrl || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-amber-600 to-orange-700 text-white font-bold text-sm">
                            {persona.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        {persona.isOnline && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0f1117]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-semibold text-slate-100 text-sm truncate">{persona.name}</h3>
                          {index === 0 && <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                        </div>
                        <p className="text-[10px] text-slate-500 truncate">@{persona.username}</p>
                        {persona.bio && (
                          <p className="text-[10px] text-slate-400/60 line-clamp-1 mt-0.5">{persona.bio}</p>
                        )}
                      </div>
                      {/* Featured rank badge */}
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${
                        index === 0 ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white' :
                        index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-slate-800' :
                        'bg-gradient-to-br from-amber-700 to-amber-800 text-amber-200'
                      }`}>
                        {index + 1}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        
        {/* Discovery Grid */}
        {isLoadingDiscovery ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="persona-card overflow-hidden animate-pulse">
                <div className="pt-4 pb-2 flex justify-center">
                  <div className={`w-16 h-16 rounded-full ${accent.bgSubtle}`} />
                </div>
                <div className="px-3 pb-3 text-center">
                  <div className={`h-4 ${accent.bgSubtle} rounded w-3/4 mx-auto`} />
                  <div className="h-3 bg-white/[0.05] rounded w-1/2 mx-auto mt-2" />
                  <div className="h-8 bg-white/[0.05] rounded mt-3" />
                </div>
              </div>
            ))}
          </div>
        ) : onlinePersonas.length === 0 ? (
          <div className="persona-empty-state persona-card py-12">
            <div className="persona-empty-state-icon">
              <Users className="w-8 h-8" />
            </div>
            <p className="text-slate-200">No personas found.</p>
            <p className="text-slate-500 text-sm mt-1">Try adjusting your search filters!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {onlinePersonas.map((persona) => (
              <PersonaCard
                key={persona.id}
                persona={persona}
                onStartChat={startConversation}
                onViewProfile={setSelectedPersona}
              />
            ))}
          </div>
        )}
      </div>
      </div>
      
      <MyPersonasModal isOpen={showPersonasModal} onClose={() => setShowPersonasModal(false)} />
      <ChunkErrorBoundary>
        <Suspense fallback={<ModalSkeleton />}>
          <PersonaForm isOpen={showCreatePersonaModal} onClose={() => setShowCreatePersonaModal(false)} onSave={handleSavePersona} isUserAdult={userIsAdult} />
        </Suspense>
      </ChunkErrorBoundary>
      
      {/* Character Profile Modal */}
      {selectedPersona && (
        <Suspense fallback={null}>
          <CharacterProfileModal
            persona={selectedPersona}
            isOpen={!!selectedPersona}
            onClose={() => setSelectedPersona(null)}
            onStartChat={(personaId) => {
              startConversation(personaId)
              setSelectedPersona(null)
            }}
          />
        </Suspense>
      )}
      
      {/* DM Request Dialog */}
      <DmRequestDialog
        isOpen={showDmRequestDialog}
        onClose={() => { setShowDmRequestDialog(false); setDmRequestTarget(null) }}
        targetPersona={dmRequestTarget}
        myPersona={activePersona}
        onSuccess={handleDmRequestSuccess}
      />
    </div>
  )
}

// ==================== CHAT LANDING PAGE WRAPPER ====================
function ChatLandingPageWrapper({ 
  onSelectChat, 
  onStartChat, 
  activePersonaId 
}: { 
  onSelectChat: (conversationId: string) => void
  onStartChat: (conv: Conversation) => void
  activePersonaId: string | null
}) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [onlinePersonas, setOnlinePersonas] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [convRes, onlineRes] = await Promise.all([
          fetch('/api/conversations'),
          fetch('/api/personas/online'),
        ])
        if (convRes.ok) {
          const data = await convRes.json()
          setConversations(data.conversations || [])
        }
        if (onlineRes.ok) {
          const data = await onlineRes.json()
          setOnlinePersonas(data.personas || [])
        }
      } catch (err) {
        console.error('Failed to fetch chat data:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleStartChatFromOnline = useCallback(async (params: { targetPersonaId: string; myPersonaId?: string }) => {
    if (!params.targetPersonaId) return
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPersonaId: params.targetPersonaId, myPersonaId: params.myPersonaId || activePersonaId }),
      })
      if (response.ok) {
        const data = await response.json()
        if (data.conversation) {
          onSelectChat(data.conversation.id)
        } else if (data.needsDmRequest) {
          alert('This user requires DM approval. Your request has been sent!')
        }
      } else {
        const data = await response.json().catch(() => ({}))
        alert(data.error || 'Failed to start conversation')
      }
    } catch (err) {
      console.error('Failed to start chat:', err)
    }
  }, [onSelectChat, activePersonaId])

  return (
    <Suspense fallback={<ComponentSkeleton className="h-full" />}>
      <ChatLandingPage
        conversations={conversations}
        onlinePersonas={onlinePersonas}
        onSelectChat={onSelectChat}
        onStartChat={handleStartChatFromOnline}
        activePersonaId={activePersonaId}
        isLoading={isLoading}
      />
    </Suspense>
  )
}

// ==================== MAIN APP ====================
function MainApp() {
  const [activeTab, setActiveTab] = useState<'home' | 'friends' | 'storylines' | 'chat' | 'wallet' | 'admin' | 'marketplace'>('home')
  const [activeChat, setActiveChat] = useState<Conversation | null>(null)
  const [activeStorylineId, setActiveStorylineId] = useState<string | null>(null)
  const [showCreatePersonaModal, setShowCreatePersonaModal] = useState(false)
  const [showAchievementModal, setShowAchievementModal] = useState(false)
  const [showMyPersonasModal, setShowMyPersonasModal] = useState(false)
  const [showEditProfileModal, setShowEditProfileModal] = useState(false)

  // UI variant determines the entire layout structure
  const { variant: uiVariant } = useUIVariant()

  // Navigation mode: 'static' (sidebar) or 'linear' (topbar + DM sidebar) — only used for Chrona layout
  const [navigationMode, setNavigationMode] = useState<'static' | 'linear'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('chrona-navigation-mode')
        if (stored === 'linear' || stored === 'static') return stored
      } catch {}
    }
    return 'static'
  })
  
  // Single global DM sidebar collapse state (persists across tabs)
  const [isDMSidebarCollapsed, setIsDMSidebarCollapsed] = useState(false)
  // Track if sidebar was auto-collapsed by marketplace (vs user manually collapsed)
  const wasAutoCollapsedByMarketplaceRef = useRef(false)
  
  const [isElectron] = useState(() => typeof window !== 'undefined' && !!(window as any).electronAPI)
  const { createPersona, activePersona } = usePersonas()
  const { user: authUser } = useAuth()

  // Sync navigation mode from user preferences via a ref-based comparison
  const prevUserNavModeRef = useRef<string | undefined>(undefined)
  const userNavMode = authUser?.navigationMode
  if (userNavMode !== prevUserNavModeRef.current) {
    prevUserNavModeRef.current = userNavMode
    if (userNavMode === 'linear' || userNavMode === 'static') {
      // Use a microtask to avoid calling setState during render
      queueMicrotask(() => {
        setNavigationMode(userNavMode as 'static' | 'linear')
        try { localStorage.setItem('chrona-navigation-mode', userNavMode) } catch {}
      })
    }
  }

  // Listen for navigation mode changes from topbar dropdown
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

  // Listen for achievement modal open event
  useEffect(() => {
    const handler = () => setShowAchievementModal(true)
    window.addEventListener('chrona:open-achievements', handler)
    return () => window.removeEventListener('chrona:open-achievements', handler)
  }, [])

  // Listen for edit profile modal open event
  useEffect(() => {
    const handler = () => setShowEditProfileModal(true)
    window.addEventListener('chrona:open-edit-profile', handler)
    return () => window.removeEventListener('chrona:open-edit-profile', handler)
  }, [])

  // Listen for my personas modal open event
  useEffect(() => {
    const handler = () => setShowMyPersonasModal(true)
    window.addEventListener('chrona:open-my-personas', handler)
    return () => window.removeEventListener('chrona:open-my-personas', handler)
  }, [])

  // Custom setActiveTab that handles marketplace sidebar behavior
  const handleSetActiveTab = useCallback((newTab: typeof activeTab) => {
    // If entering marketplace, force collapse and remember if it was already collapsed
    if (newTab === 'marketplace' && activeTab !== 'marketplace') {
      if (!isDMSidebarCollapsed) {
        wasAutoCollapsedByMarketplaceRef.current = true
      }
      setIsDMSidebarCollapsed(true)
    }
    // If leaving marketplace, only expand if we auto-collapsed it
    else if (activeTab === 'marketplace' && newTab !== 'marketplace' && wasAutoCollapsedByMarketplaceRef.current) {
      setIsDMSidebarCollapsed(false)
      wasAutoCollapsedByMarketplaceRef.current = false
    }
    setActiveTab(newTab)
  }, [activeTab, isDMSidebarCollapsed])
  
  // Handle toggling sidebar collapse (not allowed on marketplace)
  const handleToggleDMSidebar = useCallback(() => {
    // Don't allow toggling on marketplace tab
    if (activeTab === 'marketplace') return
    setIsDMSidebarCollapsed(prev => !prev)
    // If user manually toggles, it's no longer auto-collapsed
    wasAutoCollapsedByMarketplaceRef.current = false
  }, [activeTab])
  
  // Handle selecting a chat from sidebar
  const handleSelectChat = useCallback(async (conversationId: string) => {
    try {
      const response = await fetch('/api/conversations')
      if (response.ok) {
        const data = await response.json()
        const conv = data.conversations.find((c: Conversation) => c.id === conversationId)
        if (conv) {
          setActiveChat(conv)
          handleSetActiveTab('chat')
        }
      }
    } catch (error) {
      console.error('Failed to fetch conversation:', error)
    }
  }, [handleSetActiveTab])
  
  // Handle selecting a storyline
  const handleSelectStoryline = useCallback((storylineId: string) => {
    setActiveStorylineId(storylineId)
    handleSetActiveTab('storylines')
  }, [handleSetActiveTab])
  
  // Handle starting a chat from discovery
  const handleStartChat = useCallback((conv: Conversation) => {
    setActiveChat(conv)
    handleSetActiveTab('chat')
  }, [handleSetActiveTab])
  
  // Handle creating persona
  const handleSavePersona = useCallback(async (data: PersonaFormData) => {
    await createPersona(data)
    setShowCreatePersonaModal(false)
  }, [createPersona])
  
  // Navigation handler shared across all layouts
  const handleNavigate = useCallback((item: string) => {
    if (item === 'discover') { handleSetActiveTab('home'); return }
    if (item === 'achievements') {
      window.dispatchEvent(new CustomEvent('chrona:open-achievements'))
      return
    }
    const tabMap: Record<string, string> = {
      'friends': 'friends',
      'marketplace': 'marketplace',
      'chronos': 'wallet',
      'chat': 'chat',
      'storylines': 'storylines',
      'admin': 'admin',
    }
    handleSetActiveTab(tabMap[item] as any || 'home')
    setActiveStorylineId(null)
    if (item !== 'chat') setActiveChat(null)
  }, [handleSetActiveTab])

  // Security key reveal handler for EditProfileModal
  const handleRevealSecurityKey = useCallback(async () => {
    try {
      const response = await apiFetch('/api/auth/security-key', {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        // For now, just alert the key - could be enhanced with a dedicated modal
        alert(`Your new security key: ${data.securityKey}\n\nPlease save this key securely!`)
      }
    } catch (error) {
      console.error('Failed to generate security key:', error)
    }
  }, [])

  // Render main content based on active tab (shared by all layouts)
  const mainContent = activeStorylineId ? (
    <Suspense fallback={<ComponentSkeleton className="h-full" />}>
      <StorylineInterior 
        storylineId={activeStorylineId} 
        onBack={() => setActiveStorylineId(null)} 
      />
    </Suspense>
  ) : activeTab === 'chat' && activeChat ? (
    <ChatView conversation={activeChat} onBack={() => { setActiveChat(null); handleSetActiveTab('home') }} />
  ) : activeTab === 'chat' ? (
    <Suspense fallback={<ComponentSkeleton className="h-full" />}>
      <ChatLandingPageWrapper onSelectChat={handleSelectChat} onStartChat={handleStartChat} activePersonaId={activePersona?.id || null} />
    </Suspense>
  ) : activeTab === 'friends' ? (
    <FriendsPage onStartChat={handleStartChat} />
  ) : activeTab === 'storylines' ? (
    <StorylinesPage onViewStoryline={handleSelectStoryline} onStartChat={handleStartChat} />
  ) : activeTab === 'wallet' ? (
    <Suspense fallback={<ComponentSkeleton className="h-full" />}>
      <WalletPage />
    </Suspense>
  ) : activeTab === 'marketplace' ? (
    <Suspense fallback={<ComponentSkeleton className="h-full" />}>
      <MarketplacePage />
    </Suspense>
  ) : activeTab === 'admin' ? (
    <Suspense fallback={<ComponentSkeleton className="h-full" />}>
      <AdminPanel />
    </Suspense>
  ) : (
    <HomePageContent onStartChat={handleStartChat} onNavigate={handleNavigate} navigationMode={navigationMode} onOpenEditProfile={() => {
      window.dispatchEvent(new CustomEvent('chrona:open-edit-profile'))
    }} onOpenMyPersonas={() => {
      handleSetActiveTab('home')
      window.dispatchEvent(new CustomEvent('chrona:open-my-personas'))
    }} />
  )

  // ===== CHRONA LAYOUT (Default - Sidebar + DM Panel) =====
  if (uiVariant === 'chrona') {
    return (
      <div className="h-screen w-full overflow-hidden bg-gradient-to-b from-[#0b0d11] via-[#0f1117] to-[#0b0d11] text-slate-100">
        <div className="flex h-full">
          {navigationMode === 'static' ? (
            <Sidebar
              activeTab={activeTab}
              activeStorylineId={activeStorylineId}
              onSelectTab={(tab) => {
                handleSetActiveTab(tab)
                setActiveStorylineId(null)
                if (tab !== 'chat') setActiveChat(null)
              }}
              onSelectStoryline={handleSelectStoryline}
              onCreatePersona={() => setShowCreatePersonaModal(true)}
            />
          ) : (
            <DMSidebar
              activeChatId={activeChat?.id || null}
              onSelectChat={handleSelectChat}
              isCollapsed={isDMSidebarCollapsed}
              onToggleCollapse={handleToggleDMSidebar}
            />
          )}
          {navigationMode === 'static' && (
            <DMSidebar
              activeChatId={activeChat?.id || null}
              onSelectChat={handleSelectChat}
              isCollapsed={isDMSidebarCollapsed}
              onToggleCollapse={handleToggleDMSidebar}
            />
          )}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {navigationMode === 'linear' && (
              <NavigationTopbar
                variant="default"
                activeItem={activeTab === 'wallet' ? 'chronos' : activeTab}
                onNavigate={handleNavigate}
                onOpenEditProfile={() => window.dispatchEvent(new CustomEvent('chrona:open-edit-profile'))}
                onOpenMyPersonas={() => { handleSetActiveTab('home'); window.dispatchEvent(new CustomEvent('chrona:open-my-personas')) }}
                onOpenFindUsers={() => window.dispatchEvent(new CustomEvent('chrona:open-find-users'))}
              />
            )}
            {mainContent}
          </div>
        </div>
        
        <ChunkErrorBoundary>
          <Suspense fallback={<ModalSkeleton />}>
            <PersonaForm 
              isOpen={showCreatePersonaModal} 
              onClose={() => setShowCreatePersonaModal(false)} 
              onSave={handleSavePersona} 
              isUserAdult={authUser?.dateOfBirth ? isAdult(new Date(authUser.dateOfBirth)) : false}
            />
          </Suspense>
        </ChunkErrorBoundary>
        <NotificationModal />
        <AchievementModal isOpen={showAchievementModal} onClose={() => setShowAchievementModal(false)} />
        <MyPersonasModal isOpen={showMyPersonasModal} onClose={() => setShowMyPersonasModal(false)} />
        <EditProfileModal isOpen={showEditProfileModal} onClose={() => setShowEditProfileModal(false)} onRevealSecurityKey={handleRevealSecurityKey} />
      </div>
    )
  }

  // ===== CHRONA V2 LAYOUT (Floating Dock with Violet Accent) =====
  if (uiVariant === 'chrona-v2') {
    return (
      <div className="h-screen w-full overflow-hidden text-slate-100">
        <Suspense fallback={<ComponentSkeleton className="h-full" />}>
          <ChronaV2Shell
            activeTab={activeTab}
            activeStorylineId={activeStorylineId}
            activeChat={activeChat}
            onSelectTab={(tab) => { handleSetActiveTab(tab); setActiveStorylineId(null); if (tab !== 'chat') setActiveChat(null) }}
            onSelectStoryline={handleSelectStoryline}
            onSelectChat={handleSelectChat}
            onStartChat={handleStartChat}
            onNavigate={handleNavigate}
            onOpenEditProfile={() => window.dispatchEvent(new CustomEvent('chrona:open-edit-profile'))}
            onOpenMyPersonas={() => { handleSetActiveTab('home'); window.dispatchEvent(new CustomEvent('chrona:open-my-personas')) }}
            onCreatePersona={() => setShowCreatePersonaModal(true)}
          >
            {mainContent}
          </ChronaV2Shell>
        </Suspense>
        
        <ChunkErrorBoundary>
          <Suspense fallback={<ModalSkeleton />}>
            <PersonaForm 
              isOpen={showCreatePersonaModal} 
              onClose={() => setShowCreatePersonaModal(false)} 
              onSave={handleSavePersona} 
              isUserAdult={authUser?.dateOfBirth ? isAdult(new Date(authUser.dateOfBirth)) : false}
            />
          </Suspense>
        </ChunkErrorBoundary>
        <NotificationModal />
        <AchievementModal isOpen={showAchievementModal} onClose={() => setShowAchievementModal(false)} />
        <MyPersonasModal isOpen={showMyPersonasModal} onClose={() => setShowMyPersonasModal(false)} />
        <EditProfileModal isOpen={showEditProfileModal} onClose={() => setShowEditProfileModal(false)} onRevealSecurityKey={handleRevealSecurityKey} />
      </div>
    )
  }

  // ===== CHRONA V3 LAYOUT (Zen Centered with Rose Accent) =====
  if (uiVariant === 'chrona-v3') {
    return (
      <div className="h-screen w-full overflow-hidden text-slate-100">
        <Suspense fallback={<ComponentSkeleton className="h-full" />}>
          <ChronaV3Shell
            activeTab={activeTab}
            activeStorylineId={activeStorylineId}
            activeChat={activeChat}
            onSelectTab={(tab) => { handleSetActiveTab(tab); setActiveStorylineId(null); if (tab !== 'chat') setActiveChat(null) }}
            onSelectStoryline={handleSelectStoryline}
            onSelectChat={handleSelectChat}
            onStartChat={handleStartChat}
            onNavigate={handleNavigate}
            onOpenEditProfile={() => window.dispatchEvent(new CustomEvent('chrona:open-edit-profile'))}
            onOpenMyPersonas={() => { handleSetActiveTab('home'); window.dispatchEvent(new CustomEvent('chrona:open-my-personas')) }}
            onCreatePersona={() => setShowCreatePersonaModal(true)}
          >
            {mainContent}
          </ChronaV3Shell>
        </Suspense>
        
        <ChunkErrorBoundary>
          <Suspense fallback={<ModalSkeleton />}>
            <PersonaForm 
              isOpen={showCreatePersonaModal} 
              onClose={() => setShowCreatePersonaModal(false)} 
              onSave={handleSavePersona} 
              isUserAdult={authUser?.dateOfBirth ? isAdult(new Date(authUser.dateOfBirth)) : false}
            />
          </Suspense>
        </ChunkErrorBoundary>
        <NotificationModal />
        <AchievementModal isOpen={showAchievementModal} onClose={() => setShowAchievementModal(false)} />
        <MyPersonasModal isOpen={showMyPersonasModal} onClose={() => setShowMyPersonasModal(false)} />
        <EditProfileModal isOpen={showEditProfileModal} onClose={() => setShowEditProfileModal(false)} onRevealSecurityKey={handleRevealSecurityKey} />
      </div>
    )
  }

  // ===== HORIZON LAYOUT (Top-nav SaaS style) =====
  if (uiVariant === 'horizon') {
    return (
      <div className="h-screen w-full overflow-hidden text-slate-100">
        <Suspense fallback={<ComponentSkeleton className="h-full" />}>
          <HorizonShell
            activeTab={activeTab}
            activeStorylineId={activeStorylineId}
            activeChat={activeChat}
            onSelectTab={(tab) => { handleSetActiveTab(tab); setActiveStorylineId(null); if (tab !== 'chat') setActiveChat(null) }}
            onSelectStoryline={handleSelectStoryline}
            onSelectChat={handleSelectChat}
            onStartChat={handleStartChat}
            onNavigate={handleNavigate}
            onOpenEditProfile={() => window.dispatchEvent(new CustomEvent('chrona:open-edit-profile'))}
            onOpenMyPersonas={() => { handleSetActiveTab('home'); window.dispatchEvent(new CustomEvent('chrona:open-my-personas')) }}
            onCreatePersona={() => setShowCreatePersonaModal(true)}
          >
            {mainContent}
          </HorizonShell>
        </Suspense>
        
        <ChunkErrorBoundary>
          <Suspense fallback={<ModalSkeleton />}>
            <PersonaForm 
              isOpen={showCreatePersonaModal} 
              onClose={() => setShowCreatePersonaModal(false)} 
              onSave={handleSavePersona} 
              isUserAdult={authUser?.dateOfBirth ? isAdult(new Date(authUser.dateOfBirth)) : false}
            />
          </Suspense>
        </ChunkErrorBoundary>
        <NotificationModal />
        <AchievementModal isOpen={showAchievementModal} onClose={() => setShowAchievementModal(false)} />
        <MyPersonasModal isOpen={showMyPersonasModal} onClose={() => setShowMyPersonasModal(false)} />
        <EditProfileModal isOpen={showEditProfileModal} onClose={() => setShowEditProfileModal(false)} onRevealSecurityKey={handleRevealSecurityKey} />
      </div>
    )
  }

  // ===== PULSE LAYOUT (Social feed style) =====
  if (uiVariant === 'pulse') {
    return (
      <div className="h-screen w-full overflow-hidden text-slate-100">
        <Suspense fallback={<ComponentSkeleton className="h-full" />}>
          <PulseShell
            activeTab={activeTab}
            activeStorylineId={activeStorylineId}
            activeChat={activeChat}
            onSelectTab={(tab) => { handleSetActiveTab(tab); setActiveStorylineId(null); if (tab !== 'chat') setActiveChat(null) }}
            onSelectStoryline={handleSelectStoryline}
            onSelectChat={handleSelectChat}
            onStartChat={handleStartChat}
            onNavigate={handleNavigate}
            onOpenEditProfile={() => window.dispatchEvent(new CustomEvent('chrona:open-edit-profile'))}
            onOpenMyPersonas={() => { handleSetActiveTab('home'); window.dispatchEvent(new CustomEvent('chrona:open-my-personas')) }}
            onCreatePersona={() => setShowCreatePersonaModal(true)}
          >
            {mainContent}
          </PulseShell>
        </Suspense>
        
        <ChunkErrorBoundary>
          <Suspense fallback={<ModalSkeleton />}>
            <PersonaForm 
              isOpen={showCreatePersonaModal} 
              onClose={() => setShowCreatePersonaModal(false)} 
              onSave={handleSavePersona} 
              isUserAdult={authUser?.dateOfBirth ? isAdult(new Date(authUser.dateOfBirth)) : false}
            />
          </Suspense>
        </ChunkErrorBoundary>
        <NotificationModal />
        <AchievementModal isOpen={showAchievementModal} onClose={() => setShowAchievementModal(false)} />
        <MyPersonasModal isOpen={showMyPersonasModal} onClose={() => setShowMyPersonasModal(false)} />
        <EditProfileModal isOpen={showEditProfileModal} onClose={() => setShowEditProfileModal(false)} onRevealSecurityKey={handleRevealSecurityKey} />
      </div>
    )
  }

  // ===== NEXUS LAYOUT (Power-user dashboard) =====
  if (uiVariant === 'nexus') {
    return (
      <div className="h-screen w-full overflow-hidden text-slate-100">
        <Suspense fallback={<ComponentSkeleton className="h-full" />}>
          <NexusShell
            activeTab={activeTab}
            activeStorylineId={activeStorylineId}
            activeChat={activeChat}
            onSelectTab={(tab) => { handleSetActiveTab(tab); setActiveStorylineId(null); if (tab !== 'chat') setActiveChat(null) }}
            onSelectStoryline={handleSelectStoryline}
            onSelectChat={handleSelectChat}
            onStartChat={handleStartChat}
            onNavigate={handleNavigate}
            onOpenEditProfile={() => window.dispatchEvent(new CustomEvent('chrona:open-edit-profile'))}
            onOpenMyPersonas={() => { handleSetActiveTab('home'); window.dispatchEvent(new CustomEvent('chrona:open-my-personas')) }}
            onCreatePersona={() => setShowCreatePersonaModal(true)}
          >
            {mainContent}
          </NexusShell>
        </Suspense>
        
        <ChunkErrorBoundary>
          <Suspense fallback={<ModalSkeleton />}>
            <PersonaForm 
              isOpen={showCreatePersonaModal} 
              onClose={() => setShowCreatePersonaModal(false)} 
              onSave={handleSavePersona} 
              isUserAdult={authUser?.dateOfBirth ? isAdult(new Date(authUser.dateOfBirth)) : false}
            />
          </Suspense>
        </ChunkErrorBoundary>
        <NotificationModal />
        <AchievementModal isOpen={showAchievementModal} onClose={() => setShowAchievementModal(false)} />
        <MyPersonasModal isOpen={showMyPersonasModal} onClose={() => setShowMyPersonasModal(false)} />
        <EditProfileModal isOpen={showEditProfileModal} onClose={() => setShowEditProfileModal(false)} onRevealSecurityKey={handleRevealSecurityKey} />
      </div>
    )
  }

  // Fallback (should never reach)
  return null
}

// ==================== MAIN PAGE ====================
export default function Page() {
  const { isLoading, isAuthenticated } = useAuth()
  const [showLoadingScreen, setShowLoadingScreen] = useState(true)

  const handleLoadingFinished = useCallback(() => {
    setShowLoadingScreen(false)
  }, [])

  // Show loading screen on initial load
  if (showLoadingScreen) {
    return <LoadingScreen onFinished={handleLoadingFinished} />
  }

  if (isLoading) {
    return (
      <div className="min-h-screen persona-bg flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
      </div>
    )
  }
  
  if (!isAuthenticated) return <AuthPage />
  return <MainApp />
}