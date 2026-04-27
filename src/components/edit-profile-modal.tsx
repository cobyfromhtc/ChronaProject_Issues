'use client'

import { useState, useEffect, useRef, startTransition } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  X, Crown, Check, Edit2, Loader2, Camera, User, Calendar,
  Coins, Users as UsersIcon, ArrowRightLeft, Sparkles,
  MapPin, Smile, Globe, Link2, Eye, EyeOff,
  ChevronUp, ChevronDown, Image as ImageIcon, MessageCircle,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

// ========================
// Types
// ========================

interface LinkedAccount {
  id: string
  email: string | null
  username: string
  avatarUrl: string | null
  role: string
  isActive: boolean
}

interface ProfileStats {
  totalPersonas: number
  chronos: number
  createdAt: string
}

interface EditProfileModalProps {
  isOpen: boolean
  onClose: () => void
  onRevealSecurityKey: () => void
}

// Social link platform definition
interface SocialPlatform {
  key: string
  label: string
  placeholder: string
  prefix?: string
  icon: React.ReactNode
  color: string
  type: 'username' | 'url'
}

interface SocialLinkEntry {
  platform: string
  value: string
  visible: boolean
}

// ========================
// Social Platform Definitions
// ========================

const SOCIAL_PLATFORMS: SocialPlatform[] = [
  {
    key: 'youtube',
    label: 'YouTube',
    placeholder: 'Channel URL',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
    color: '#FF0000',
    type: 'url',
  },
  {
    key: 'instagram',
    label: 'Instagram',
    placeholder: 'Username',
    prefix: '@',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
      </svg>
    ),
    color: '#E4405F',
    type: 'username',
  },
  {
    key: 'discord',
    label: 'Discord',
    placeholder: 'username',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
      </svg>
    ),
    color: '#5865F2',
    type: 'username',
  },
  {
    key: 'twitter',
    label: 'X (Twitter)',
    placeholder: 'Handle',
    prefix: '@',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    color: '#000000',
    type: 'username',
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    placeholder: 'Username',
    prefix: '@',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
      </svg>
    ),
    color: '#000000',
    type: 'username',
  },
  {
    key: 'twitch',
    label: 'Twitch',
    placeholder: 'Channel name',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
      </svg>
    ),
    color: '#9146FF',
    type: 'username',
  },
  {
    key: 'spotify',
    label: 'Spotify',
    placeholder: 'Profile URL',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
      </svg>
    ),
    color: '#1DB954',
    type: 'url',
  },
  {
    key: 'reddit',
    label: 'Reddit',
    placeholder: 'Username',
    prefix: 'u/',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
      </svg>
    ),
    color: '#FF4500',
    type: 'username',
  },
  {
    key: 'steam',
    label: 'Steam',
    placeholder: 'Profile URL',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z"/>
      </svg>
    ),
    color: '#1B2838',
    type: 'url',
  },
  {
    key: 'github',
    label: 'GitHub',
    placeholder: 'Username',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
      </svg>
    ),
    color: '#FFFFFF',
    type: 'username',
  },
  {
    key: 'website',
    label: 'Website',
    placeholder: 'https://your-site.com',
    icon: <Globe className="w-4 h-4" />,
    color: '#6366F1',
    type: 'url',
  },
]

const PRONOUN_OPTIONS = [
  '', 'he/him', 'she/her', 'they/them',
  'he/they', 'she/they', 'neopronouns',
  'ask me', 'other',
]

type ActiveSection = 'profile' | 'social' | 'accounts'

// ========================
// Component
// ========================

export function EditProfileModal({ isOpen, onClose, onRevealSecurityKey }: EditProfileModalProps) {
  const { user, setUser, switchAccount } = useAuth()
  const { toast } = useToast()

  // Form state
  const [newUsername, setNewUsername] = useState('')
  const [isChangingName, setIsChangingName] = useState(false)
  const [error, setError] = useState('')

  const [bio, setBio] = useState('')
  const [isSavingBio, setIsSavingBio] = useState(false)

  const [status, setStatus] = useState('')
  const [pronouns, setPronouns] = useState('')
  const [location, setLocation] = useState('')

  // Avatar / Banner upload
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isUploadingBanner, setIsUploadingBanner] = useState(false)
  const avatarFileRef = useRef<HTMLInputElement>(null)
  const bannerFileRef = useRef<HTMLInputElement>(null)
  const [isDraggingAvatar, setIsDraggingAvatar] = useState(false)
  const [isDraggingBanner, setIsDraggingBanner] = useState(false)

  // Social links
  const [socialLinks, setSocialLinks] = useState<SocialLinkEntry[]>([])
  const [isSavingSocial, setIsSavingSocial] = useState(false)

  // Account stats
  const [stats, setStats] = useState<ProfileStats | null>(null)

  // Account switcher
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([])
  const [isSwitching, setIsSwitching] = useState<string | null>(null)

  // Active section
  const [activeSection, setActiveSection] = useState<ActiveSection>('profile')

  // Initialize form values when user changes or modal opens
  useEffect(() => {
    if (!user || !isOpen) return

    startTransition(() => {
      setBio(user.bio || '')
      setStatus(user.status || '')
      setPronouns(user.pronouns || '')
      setLocation(user.location || '')
      // Parse social links from JSON string
      try {
        const parsed = user.socialLinks ? JSON.parse(user.socialLinks) : []
        setSocialLinks(
          SOCIAL_PLATFORMS.map((p) => {
            const existing = parsed.find((e: SocialLinkEntry) => e.platform === p.key)
            return existing || { platform: p.key, value: '', visible: true }
          })
        )
      } catch {
        setSocialLinks(
          SOCIAL_PLATFORMS.map((p) => ({ platform: p.key, value: '', visible: true }))
        )
      }
    })

    // Fetch profile stats and linked accounts
    const controller = new AbortController()

    fetch('/api/user/profile', { signal: controller.signal })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) {
          startTransition(() => {
            setStats({
              totalPersonas: data.profile.totalPersonas,
              chronos: data.profile.chronos,
              createdAt: data.profile.createdAt,
            })
          })
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') console.error('Failed to fetch profile stats:', err)
      })

    fetch('/api/auth/accounts', { signal: controller.signal })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) {
          startTransition(() => {
            setLinkedAccounts(data.accounts || [])
          })
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') console.error('Failed to fetch accounts:', err)
      })

    return () => controller.abort()
  }, [user, isOpen])

  // ========================
  // Handlers
  // ========================

  const handleChangeUsername = async () => {
    if (!newUsername.trim()) {
      setError('Please enter a new username')
      return
    }

    if (newUsername.length < 3 || newUsername.length > 20) {
      setError('Username must be 3-20 characters')
      return
    }

    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
      setError('Username can only contain letters, numbers, and underscores')
      return
    }

    setIsChangingName(true)
    setError('')

    try {
      const response = await fetch('/api/user/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newUsername: newUsername.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change username')
      }

      setUser(data.user)
      setNewUsername('')
      toast({ title: 'Username updated!', description: `Your username is now ${data.user.username}` })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change username')
    } finally {
      setIsChangingName(false)
    }
  }

  const handleSaveProfile = async (fields: Record<string, unknown>) => {
    setError('')

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile')
      }

      setUser(data.user)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile')
      return false
    }
  }

  const handleSaveBio = async () => {
    setIsSavingBio(true)
    const ok = await handleSaveProfile({ bio })
    if (ok) {
      toast({ title: 'Bio updated!', description: 'Your bio has been saved.' })
    }
    setIsSavingBio(false)
  }

  const handleSaveStatus = async () => {
    const ok = await handleSaveProfile({ status })
    if (ok) {
      toast({ title: 'Status updated!', description: status || 'Status cleared.' })
    }
  }

  const handleSavePronouns = async () => {
    const ok = await handleSaveProfile({ pronouns })
    if (ok) {
      toast({ title: 'Pronouns updated!', description: pronouns || 'Pronouns cleared.' })
    }
  }

  const handleSaveLocation = async () => {
    const ok = await handleSaveProfile({ location })
    if (ok) {
      toast({ title: 'Location updated!', description: location || 'Location cleared.' })
    }
  }

  const handleImageUpload = async (
    file: File,
    type: 'avatar' | 'banner'
  ) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please select an image file', variant: 'destructive' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Image must be less than 5MB', variant: 'destructive' })
      return
    }

    const setUploading = type === 'avatar' ? setIsUploadingAvatar : setIsUploadingBanner
    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      const uploadResponse = await fetch('/api/upload', { method: 'POST', body: formData })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image')
      }

      const uploadData = await uploadResponse.json()
      const urlField = type === 'avatar' ? 'avatarUrl' : 'bannerUrl'
      const ok = await handleSaveProfile({ [urlField]: uploadData.url })

      if (ok) {
        toast({
          title: `${type === 'avatar' ? 'Avatar' : 'Banner'} updated!`,
          description: `Your ${type} has been changed.`,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to upload ${type}`)
    } finally {
      setUploading(false)
      if (type === 'avatar' && avatarFileRef.current) avatarFileRef.current.value = ''
      if (type === 'banner' && bannerFileRef.current) bannerFileRef.current.value = ''
    }
  }

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleImageUpload(file, 'avatar')
  }

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleImageUpload(file, 'banner')
  }

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent, type: 'avatar' | 'banner') => {
    e.preventDefault()
    e.stopPropagation()
    if (type === 'avatar') setIsDraggingAvatar(true)
    else setIsDraggingBanner(true)
  }

  const handleDragLeave = (e: React.DragEvent, type: 'avatar' | 'banner') => {
    e.preventDefault()
    e.stopPropagation()
    if (type === 'avatar') setIsDraggingAvatar(false)
    else setIsDraggingBanner(false)
  }

  const handleDrop = (e: React.DragEvent, type: 'avatar' | 'banner') => {
    e.preventDefault()
    e.stopPropagation()
    if (type === 'avatar') setIsDraggingAvatar(false)
    else setIsDraggingBanner(false)

    const file = e.dataTransfer.files?.[0]
    if (file) handleImageUpload(file, type)
  }

  // Social links handlers
  const handleSocialLinkChange = (platformKey: string, value: string) => {
    setSocialLinks((prev) =>
      prev.map((link) =>
        link.platform === platformKey ? { ...link, value } : link
      )
    )
  }

  const handleSocialLinkVisibility = (platformKey: string) => {
    setSocialLinks((prev) =>
      prev.map((link) =>
        link.platform === platformKey ? { ...link, visible: !link.visible } : link
      )
    )
  }

  const handleMoveSocialLink = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= socialLinks.length) return
    const updated = [...socialLinks]
    const temp = updated[index]
    updated[index] = updated[newIndex]
    updated[newIndex] = temp
    setSocialLinks(updated)
  }

  const handleSaveSocialLinks = async () => {
    setIsSavingSocial(true)
    const linksJson = JSON.stringify(socialLinks.filter((l) => l.value.trim() !== ''))
    const ok = await handleSaveProfile({ socialLinks: linksJson })
    if (ok) {
      toast({ title: 'Social links saved!', description: 'Your social links have been updated.' })
    }
    setIsSavingSocial(false)
  }

  const handleSwitchAccount = async (userId: string) => {
    setIsSwitching(userId)
    setError('')

    try {
      const result = await switchAccount(userId)
      if (result) {
        toast({ title: 'Account switched!', description: `Now using ${result.username}` })
        fetchAccounts()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch account')
    } finally {
      setIsSwitching(null)
    }
  }

  if (!isOpen || !user) return null

  const getPlatform = (key: string) => SOCIAL_PLATFORMS.find((p) => p.key === key)

  // ========================
  // Render
  // ========================

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col persona-modal overflow-hidden">
        {/* ====== Header ====== */}
        <div className="p-5 border-b border-white/[0.08] bg-gradient-to-r from-teal-900/30 to-cyan-900/20 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-400 flex items-center justify-center">
                <Edit2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Edit Profile</h2>
                <p className="text-sm text-slate-400">Customize your identity</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Section tabs */}
          <div className="flex gap-1 mt-4 persona-tabs p-1">
            {([
              { key: 'profile' as ActiveSection, label: 'Profile', icon: <User className="w-4 h-4" /> },
              { key: 'social' as ActiveSection, label: 'Social Links', icon: <Link2 className="w-4 h-4" /> },
              { key: 'accounts' as ActiveSection, label: 'Accounts', icon: <ArrowRightLeft className="w-4 h-4" /> },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveSection(tab.key)}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                  activeSection === tab.key
                    ? 'persona-tab-active text-white'
                    : 'persona-tab text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ====== Content ====== */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm persona-animate-in">
              {error}
            </div>
          )}

          {/* ==================== PROFILE SECTION ==================== */}
          {activeSection === 'profile' && (
            <div className="space-y-6">
              {/* Banner + Avatar area */}
              <div className="relative">
                {/* Banner */}
                <div
                  className={`relative w-full h-32 rounded-xl overflow-hidden group cursor-pointer transition-all ${
                    isDraggingBanner
                      ? 'ring-2 ring-teal-400 ring-offset-2 ring-offset-[#0a0c10]'
                      : 'ring-1 ring-white/[0.06]'
                  }`}
                  onClick={() => bannerFileRef.current?.click()}
                  onDragOver={(e) => handleDragOver(e, 'banner')}
                  onDragLeave={(e) => handleDragLeave(e, 'banner')}
                  onDrop={(e) => handleDrop(e, 'banner')}
                >
                  {user.bannerUrl ? (
                    <img
                      src={user.bannerUrl}
                      alt="Profile banner"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-teal-900/40 via-slate-800/60 to-cyan-900/30 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-1 text-slate-500">
                        <ImageIcon className="w-5 h-5" />
                        <span className="text-xs">Add banner</span>
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    {isUploadingBanner ? (
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    ) : (
                      <Camera className="w-6 h-6 text-white" />
                    )}
                  </div>
                  {isDraggingBanner && (
                    <div className="absolute inset-0 bg-teal-500/20 border-2 border-dashed border-teal-400 flex items-center justify-center">
                      <p className="text-teal-300 text-sm font-medium">Drop image here</p>
                    </div>
                  )}
                </div>
                <input
                  ref={bannerFileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBannerUpload}
                  className="hidden"
                />

                {/* Avatar overlapping the banner */}
                <div
                  className={`absolute -bottom-10 left-5 transition-all ${
                    isDraggingAvatar ? 'scale-105' : ''
                  }`}
                >
                  <div
                    className={`relative group cursor-pointer ${
                      isDraggingAvatar
                        ? 'ring-2 ring-teal-400 ring-offset-2 ring-offset-[#0a0c10] rounded-full'
                        : ''
                    }`}
                    onClick={(e) => {
                      e.stopPropagation()
                      avatarFileRef.current?.click()
                    }}
                    onDragOver={(e) => handleDragOver(e, 'avatar')}
                    onDragLeave={(e) => handleDragLeave(e, 'avatar')}
                    onDrop={(e) => handleDrop(e, 'avatar')}
                  >
                    <Avatar className="w-20 h-20 border-4 border-[#0f1117] rounded-full">
                      <AvatarImage src={user.avatarUrl || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-teal-500 to-cyan-400 text-white text-2xl font-semibold">
                        {user.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      {isUploadingAvatar ? (
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      ) : (
                        <Camera className="w-6 h-6 text-white" />
                      )}
                    </div>
                    {isDraggingAvatar && (
                      <div className="absolute inset-0 bg-teal-500/30 border-2 border-dashed border-teal-400 rounded-full flex items-center justify-center">
                        <p className="text-teal-300 text-[9px] font-medium text-center leading-tight">Drop</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={avatarFileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {/* User info line */}
              <div className="pt-8 pl-1 flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-slate-100 text-lg">{user.username}</p>
                {user.status && (
                  <span className="text-xs text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20 flex items-center gap-1">
                    <Smile className="w-3 h-3" />
                    {user.status}
                  </span>
                )}
                {user.pronouns && (
                  <span className="text-xs text-slate-400 bg-slate-500/10 px-2 py-0.5 rounded-full border border-slate-500/20">
                    {user.pronouns}
                  </span>
                )}
              </div>

              {/* Status field */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-sm font-medium text-slate-200">
                  <Smile className="w-3.5 h-3.5 text-teal-400" />
                  Custom Status
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={status}
                    onChange={(e) => setStatus(e.target.value.slice(0, 60))}
                    placeholder="What are you up to?"
                    className="flex-1 px-3 py-2.5 rounded-lg bg-[#0e1015] border border-teal-500/20 text-white placeholder-slate-500/40 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                    maxLength={60}
                  />
                  <button
                    onClick={handleSaveStatus}
                    disabled={status === (user.status || '')}
                    className="px-3 py-2.5 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
                  >
                    Save
                  </button>
                </div>
                <div className="flex justify-between">
                  <p className="text-xs text-slate-500">Appears next to your name</p>
                  <span className={`text-xs ${status.length > 50 ? 'text-amber-400' : 'text-slate-500'}`}>
                    {status.length}/60
                  </span>
                </div>
              </div>

              {/* Pronouns selector */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-sm font-medium text-slate-200">
                  <MessageCircle className="w-3.5 h-3.5 text-teal-400" />
                  Pronouns
                </label>
                <div className="flex gap-2 flex-wrap">
                  {PRONOUN_OPTIONS.map((option) => (
                    <button
                      key={option}
                      onClick={() => {
                        setPronouns(option)
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        pronouns === option
                          ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                          : 'bg-[#0e1015] text-slate-400 border border-white/[0.06] hover:border-teal-500/20 hover:text-slate-200'
                      }`}
                    >
                      {option || 'None'}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleSavePronouns}
                  disabled={pronouns === (user.pronouns || '')}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  Save Pronouns
                </button>
              </div>

              {/* Location field */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-sm font-medium text-slate-200">
                  <MapPin className="w-3.5 h-3.5 text-teal-400" />
                  Location
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value.slice(0, 60))}
                    placeholder="Where are you from?"
                    className="flex-1 px-3 py-2.5 rounded-lg bg-[#0e1015] border border-teal-500/20 text-white placeholder-slate-500/40 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                    maxLength={60}
                  />
                  <button
                    onClick={handleSaveLocation}
                    disabled={location === (user.location || '')}
                    className="px-3 py-2.5 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
                  >
                    Save
                  </button>
                </div>
              </div>

              {/* Bio Section */}
              <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                <label className="flex items-center gap-1.5 text-sm font-medium text-slate-200">
                  <User className="w-3.5 h-3.5 text-teal-400" />
                  About Me
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => {
                    if (e.target.value.length <= 200) setBio(e.target.value)
                  }}
                  placeholder="Tell others about yourself..."
                  className="w-full px-3 py-2.5 rounded-lg bg-[#0e1015] border border-teal-500/20 text-white placeholder-slate-500/40 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm resize-none h-20"
                  maxLength={200}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">A brief description about yourself</p>
                  <span className={`text-xs ${bio.length > 180 ? 'text-amber-400' : 'text-slate-500'}`}>
                    {bio.length}/200
                  </span>
                </div>
                <button
                  onClick={handleSaveBio}
                  disabled={isSavingBio || bio === (user.bio || '')}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                >
                  {isSavingBio ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Bio'}
                </button>
              </div>

              {/* Change Username */}
              <div className="pt-4 border-t border-white/[0.06] space-y-3">
                <label className="flex items-center gap-1.5 text-sm font-medium text-slate-200">
                  <Edit2 className="w-3.5 h-3.5 text-teal-400" />
                  Change Username
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder={user.username}
                    className="flex-1 px-3 py-2.5 rounded-lg bg-[#0e1015] border border-teal-500/20 text-white placeholder-slate-500/40 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                    maxLength={20}
                  />
                  <button
                    onClick={handleChangeUsername}
                    disabled={isChangingName || !newUsername.trim()}
                    className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                  >
                    {isChangingName ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                  </button>
                </div>
                <p className="text-xs text-slate-500">Letters, numbers, and underscores. 3-20 characters.</p>
              </div>

              {/* Account Stats */}
              {stats && (
                <div className="pt-4 border-t border-white/[0.06]">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-slate-200 mb-3">
                    <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                    Account Stats
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="persona-card p-3 text-center">
                      <Calendar className="w-4 h-4 text-teal-400 mx-auto mb-1" />
                      <p className="text-xs text-slate-500">Member Since</p>
                      <p className="text-sm font-medium text-slate-200 mt-0.5">
                        {formatDistanceToNow(new Date(stats.createdAt), { addSuffix: false })}
                      </p>
                    </div>
                    <div className="persona-card p-3 text-center">
                      <UsersIcon className="w-4 h-4 text-teal-400 mx-auto mb-1" />
                      <p className="text-xs text-slate-500">Personas</p>
                      <p className="text-sm font-medium text-slate-200 mt-0.5">{stats.totalPersonas}</p>
                    </div>
                    <div className="persona-card p-3 text-center">
                      <Coins className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                      <p className="text-xs text-slate-500">Chronos</p>
                      <p className="text-sm font-medium text-amber-300 mt-0.5">{stats.chronos}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Security Key Section */}
              <div className="pt-4 border-t border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-medium text-slate-200">
                      <Crown className="w-3.5 h-3.5 text-amber-400" />
                      Security Key
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">Required for every login</p>
                  </div>
                  <button
                    onClick={() => {
                      onClose()
                      onRevealSecurityKey()
                    }}
                    className="px-3 py-2 rounded-lg border border-amber-500/30 text-amber-400 text-sm hover:bg-amber-500/10 transition-colors flex items-center gap-2"
                  >
                    <Crown className="w-4 h-4" />
                    Generate New Key
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ==================== SOCIAL LINKS SECTION ==================== */}
          {activeSection === 'social' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                    <Link2 className="w-4 h-4 text-teal-400" />
                    Your Social Links
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Add your social media accounts. Toggle visibility to control what appears on your profile.
                  </p>
                </div>
                <button
                  onClick={handleSaveSocialLinks}
                  disabled={isSavingSocial}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 flex-shrink-0"
                >
                  {isSavingSocial ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save All
                </button>
              </div>

              <div className="space-y-2">
                {socialLinks.map((link, index) => {
                  const platform = getPlatform(link.platform)
                  if (!platform) return null

                  return (
                    <div
                      key={link.platform}
                      className={`persona-card p-3 flex items-center gap-3 transition-all ${
                        link.value.trim() ? 'border-teal-500/15' : 'opacity-60'
                      }`}
                    >
                      {/* Drag handles */}
                      <div className="flex flex-col gap-0.5 flex-shrink-0">
                        <button
                          onClick={() => handleMoveSocialLink(index, 'up')}
                          disabled={index === 0}
                          className="p-0.5 rounded text-slate-500 hover:text-slate-300 disabled:opacity-20 transition-colors"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleMoveSocialLink(index, 'down')}
                          disabled={index === socialLinks.length - 1}
                          className="p-0.5 rounded text-slate-500 hover:text-slate-300 disabled:opacity-20 transition-colors"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Platform icon */}
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${platform.color}20`, color: platform.color }}
                      >
                        {platform.icon}
                      </div>

                      {/* Input */}
                      <div className="flex-1 min-w-0">
                        <label className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                          {platform.label}
                        </label>
                        <div className="flex items-center gap-1 mt-0.5">
                          {platform.prefix && (
                            <span className="text-xs text-slate-500 font-medium">{platform.prefix}</span>
                          )}
                          <input
                            type={platform.type === 'url' ? 'url' : 'text'}
                            value={link.value}
                            onChange={(e) => handleSocialLinkChange(link.platform, e.target.value)}
                            placeholder={platform.placeholder}
                            className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 focus:outline-none min-w-0"
                          />
                        </div>
                      </div>

                      {/* Visibility toggle */}
                      <button
                        onClick={() => handleSocialLinkVisibility(link.platform)}
                        className={`p-1.5 rounded-md transition-colors flex-shrink-0 ${
                          link.visible
                            ? 'text-teal-400 hover:bg-teal-500/10'
                            : 'text-slate-600 hover:bg-slate-500/10'
                        }`}
                        title={link.visible ? 'Visible on profile' : 'Hidden from profile'}
                      >
                        {link.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    </div>
                  )
                })}
              </div>

              <p className="text-xs text-slate-500 text-center">
                Only links with a value will appear on your profile. Use the eye icon to toggle visibility.
              </p>
            </div>
          )}

          {/* ==================== ACCOUNTS SECTION ==================== */}
          {activeSection === 'accounts' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Switch between your linked accounts without logging out.
              </p>

              {linkedAccounts.length === 0 ? (
                <div className="persona-card p-6 text-center">
                  <UsersIcon className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">No other linked accounts</p>
                  <p className="text-slate-500 text-xs mt-1">
                    Sign up with another account to switch between them
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {linkedAccounts.map((account) => (
                    <div
                      key={account.id}
                      className={`persona-card p-3 flex items-center gap-3 transition-all ${
                        account.isActive
                          ? 'border-teal-500/30 bg-teal-500/[0.05]'
                          : 'hover:border-teal-500/20 cursor-pointer'
                      }`}
                    >
                      <Avatar className="w-10 h-10 border border-teal-500/15">
                        <AvatarImage src={account.avatarUrl || undefined} />
                        <AvatarFallback className="bg-gradient-to-br from-teal-500 to-cyan-400 text-white text-sm font-medium">
                          {account.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-100 truncate">
                            {account.username}
                          </p>
                          {account.isActive && (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
                              <span className="w-1 h-1 rounded-full bg-emerald-400" />
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 capitalize">
                          {account.role === 'member' || account.role === 'user' ? 'Member' : account.role}
                        </p>
                      </div>
                      {!account.isActive && (
                        <button
                          onClick={() => handleSwitchAccount(account.id)}
                          disabled={isSwitching === account.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-teal-400 border border-teal-500/20 hover:bg-teal-500/10 transition-all disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {isSwitching === account.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <ArrowRightLeft className="w-3 h-3" />
                          )}
                          Switch
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
