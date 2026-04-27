'use client'

/*
 * Tailwind safelist – variant-specific dynamic classes used via accent.* interpolation.
 * These must appear as complete strings so Tailwind's JIT scanner includes them.
 *
 * data-[state=active]: bg-slate-400/15 bg-violet-500/15 bg-rose-500/15
 * hover: from-slate-500 from-violet-500 from-rose-500 to-slate-400 to-rose-400 to-amber-400
 * hover: border-slate-400/60 border-violet-400/60 border-rose-400/60
 * hover: border-slate-500/50 border-violet-500/50 border-rose-500/50
 * hover: bg-slate-400/15 bg-violet-500/15 bg-rose-500/15
 * hover: bg-slate-500/30 bg-violet-500/30 bg-rose-500/30
 * hover: from-slate-500/20 from-violet-500/20 from-rose-500/20
 * hover: to-slate-400/10 to-rose-500/10 to-amber-500/10
 * focus: border-slate-400/30 border-violet-500/30 border-rose-500/30
 * shadow-slate-400/20 shadow-violet-500/20 shadow-rose-500/20
 * shadow-slate-500/25 shadow-violet-500/25 shadow-rose-500/25
 * shadow-slate-500/10 shadow-violet-500/10 shadow-rose-500/10
 * from-slate-500 to-slate-400 from-violet-500 to-rose-400 from-rose-500 to-amber-400
 * from-slate-500/20 to-slate-400/10 from-violet-500/20 to-rose-500/10 from-rose-500/20 to-amber-500/10
 * from-slate-400/40 to-slate-500/50 from-violet-500/40 to-rose-500/50 from-rose-500/40 to-amber-500/50
 * border-slate-400/20 border-violet-500/20 border-rose-500/20
 * border-slate-400/30 border-violet-500/30 border-rose-500/30
 * border-slate-500/40 border-violet-500/40 border-rose-500/40
 * border-slate-400 border-violet-400 border-rose-400
 * bg-slate-400/15 bg-violet-500/15 bg-rose-500/15
 * bg-slate-400/10 bg-violet-500/10 bg-rose-500/10
 * bg-slate-400/20 bg-violet-500/20 bg-rose-500/20
 * bg-slate-400/25 bg-violet-500/25 bg-rose-500/25
 * bg-slate-500 bg-violet-500 bg-rose-500
 * bg-[#0e1014] bg-[#0c0d10] bg-[#0e0a18] bg-[#0a0812] bg-[#120e0c] bg-[#0e0b09]
 * text-slate-400 text-violet-400 text-rose-400
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useChronos, CHRONOS_PRICING, CHRONOS_PACKS } from '@/stores/chronos-store'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Wallet, Clock, Sparkles, Crown, Palette, Image as ImageIcon,
  Plus, Check, Loader2, ChevronRight, Gift, Star, Zap, Send, User, MessageSquare,
  Award, TrendingUp, TrendingDown, ArrowDownUp, Flame, Heart, ShoppingBag,
  Calendar, Sun, Trophy
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useVariantAccent, useVariantCombo } from '@/lib/ui-variant-styles'
import type { VariantAccentClasses } from '@/lib/ui-variant-styles'

// Color picker options for name colors
const NAME_COLORS = [
  { name: 'Crimson', color: '#DC143C' },
  { name: 'Orange', color: '#FF6B00' },
  { name: 'Gold', color: '#FFD700' },
  { name: 'Emerald', color: '#10B981' },
  { name: 'Cyan', color: '#00BFFF' },
  { name: 'Blue', color: '#3B82F6' },
  { name: 'Purple', color: '#8B5CF6' },
  { name: 'Pink', color: '#EC4899' },
  { name: 'Rose', color: '#F43F5E' },
  { name: 'Teal', color: '#14B8A6' },
  { name: 'Indigo', color: '#6366F1' },
  { name: 'Amber', color: '#F59E0B' },
]

// Theme presets
const THEME_PRESETS = [
  { id: 'theme-sunset', name: 'Sunset', price: 100, background: 'linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)', borderColor: '#ff6b6b', textColor: '#ffffff', accentColor: '#feca57' },
  { id: 'theme-ocean', name: 'Ocean', price: 150, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderColor: '#667eea', textColor: '#ffffff', accentColor: '#764ba2' },
  { id: 'theme-forest', name: 'Forest', price: 150, background: 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)', borderColor: '#71b280', textColor: '#ffffff', accentColor: '#134e5e' },
  { id: 'theme-night', name: 'Night Sky', price: 200, background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)', borderColor: '#302b63', textColor: '#a5b4fc', accentColor: '#818cf8' },
  { id: 'theme-aurora', name: 'Aurora', price: 250, background: 'linear-gradient(135deg, #00c9ff 0%, #92fe9d 100%)', borderColor: '#00c9ff', textColor: '#0f172a', accentColor: '#92fe9d' },
  { id: 'theme-fire', name: 'Fire', price: 200, background: 'linear-gradient(135deg, #f12711 0%, #f5af19 100%)', borderColor: '#f12711', textColor: '#ffffff', accentColor: '#f5af19' },
  { id: 'theme-cosmic', name: 'Cosmic', price: 300, background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', borderColor: '#e94560', textColor: '#eaeaea', accentColor: '#e94560' },
  { id: 'theme-lavender', name: 'Lavender', price: 175, background: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)', borderColor: '#a18cd1', textColor: '#1f2937', accentColor: '#fbc2eb' },
]

// Transaction category config with icons and colors
// Note: teal/cyan entries (slot, purchase, extra_image) are overridden at render time via accent
const TRANSACTION_CATEGORIES: Record<string, { icon: React.ElementType; color: string; bgColor: string; label: string }> = {
  daily_bonus: { icon: Sun, color: 'text-amber-400', bgColor: 'bg-amber-500/15', label: 'Daily Bonus' },
  daily_login: { icon: Calendar, color: 'text-emerald-400', bgColor: 'bg-emerald-500/15', label: 'Daily Login' },
  streak_bonus: { icon: Flame, color: 'text-orange-400', bgColor: 'bg-orange-500/15', label: 'Streak Bonus' },
  slot: { icon: Plus, color: 'text-teal-400', bgColor: 'bg-teal-500/15', label: 'Persona Slot' },
  storyline: { icon: Crown, color: 'text-fuchsia-400', bgColor: 'bg-fuchsia-500/15', label: 'Storyline' },
  name_color: { icon: Palette, color: 'text-pink-400', bgColor: 'bg-pink-500/15', label: 'Name Color' },
  theme: { icon: Sparkles, color: 'text-violet-400', bgColor: 'bg-violet-500/15', label: 'Theme' },
  extra_image: { icon: ImageIcon, color: 'text-cyan-400', bgColor: 'bg-cyan-500/15', label: 'Extra Image' },
  gift_sent: { icon: Send, color: 'text-rose-400', bgColor: 'bg-rose-500/15', label: 'Gift Sent' },
  gift_received: { icon: Gift, color: 'text-emerald-400', bgColor: 'bg-emerald-500/15', label: 'Gift Received' },
  admin_grant: { icon: Award, color: 'text-amber-400', bgColor: 'bg-amber-500/15', label: 'Admin Grant' },
  purchase: { icon: ShoppingBag, color: 'text-teal-400', bgColor: 'bg-teal-500/15', label: 'Purchase' },
  earn: { icon: TrendingUp, color: 'text-emerald-400', bgColor: 'bg-emerald-500/15', label: 'Earned' },
  spend: { icon: TrendingDown, color: 'text-red-400', bgColor: 'bg-red-500/15', label: 'Spent' },
}

function getCategoryConfig(category: string, type: string, accent?: VariantAccentClasses) {
  const base = TRANSACTION_CATEGORIES[category] || (type === 'earn'
    ? { icon: TrendingUp, color: 'text-emerald-400', bgColor: 'bg-emerald-500/15', label: 'Earned' }
    : { icon: TrendingDown, color: 'text-red-400', bgColor: 'bg-red-500/15', label: 'Spent' })

  if (accent) {
    if (category === 'slot' || category === 'purchase') {
      return { ...base, color: accent.text, bgColor: accent.bgTint }
    }
    if (category === 'extra_image') {
      return { ...base, color: accent.text, bgColor: accent.bgHeavy }
    }
  }

  return base
}

// Achievement definitions
const ACHIEVEMENTS = [
  { id: 'first_purchase', name: 'First Purchase', description: 'Made your first Chronos purchase', icon: ShoppingBag, color: 'from-emerald-500 to-teal-500', condition: (data: ChronosData | null) => data?.hasFirstPurchaseBonus === true || (data?.transactions.some(t => t.type === 'spend') ?? false) },
  { id: 'generous_gifter', name: 'Generous Gifter', description: 'Sent a Chronos gift to someone', icon: Heart, color: 'from-pink-500 to-rose-500', condition: (data: ChronosData | null) => data?.transactions.some(t => t.category === 'gift_sent') ?? false },
  { id: 'daily_claimer', name: 'Daily Claimer', description: 'Claimed a daily bonus', icon: Sun, color: 'from-amber-500 to-orange-500', condition: (data: ChronosData | null) => data?.transactions.some(t => t.category === 'daily_bonus' || t.category === 'daily_login') ?? false },
  { id: 'streak_master', name: 'Streak Master', description: 'Earned a streak bonus', icon: Flame, color: 'from-orange-500 to-red-500', condition: (data: ChronosData | null) => data?.transactions.some(t => t.category === 'streak_bonus') ?? false },
  { id: 'fashionista', name: 'Fashionista', description: 'Purchased a name color or theme', icon: Palette, color: 'from-violet-500 to-purple-500', condition: (data: ChronosData | null) => data?.transactions.some(t => t.category === 'name_color' || t.category === 'theme') ?? false },
  { id: 'world_builder', name: 'World Builder', description: 'Created a storyline', icon: Crown, color: 'from-fuchsia-500 to-pink-500', condition: (data: ChronosData | null) => data?.transactions.some(t => t.category === 'storyline') ?? false },
]

// Animated counter component
function AnimatedCounter({ value, className }: { value: number; className?: string }) {
  const [displayValue, setDisplayValue] = useState(value)
  const [isAnimating, setIsAnimating] = useState(false)
  const prevValueRef = useRef(value)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    if (prevValueRef.current !== value) {
      const startValue = prevValueRef.current
      const endValue = value
      const diff = endValue - startValue
      const duration = 800
      const startTime = Date.now()

      // Schedule animation start on next frame (avoid setState directly in effect)
      const startAnimation = () => {
        setIsAnimating(true)
        
        const animate = () => {
          const elapsed = Date.now() - startTime
          const progress = Math.min(elapsed / duration, 1)
          // Ease out cubic
          const eased = 1 - Math.pow(1 - progress, 3)
          setDisplayValue(Math.round(startValue + diff * eased))

          if (progress < 1) {
            animationRef.current = requestAnimationFrame(animate)
          } else {
            setDisplayValue(endValue)
            setIsAnimating(false)
          }
        }

        animationRef.current = requestAnimationFrame(animate)
      }

      startAnimation()
      prevValueRef.current = value

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
        }
      }
    }
  }, [value])

  return (
    <span className={`${className} transition-all duration-300 ${isAnimating ? 'scale-105' : 'scale-100'}`}>
      {displayValue.toLocaleString()}
    </span>
  )
}

// Shimmer effect for pack cards
function ShimmerOverlay() {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
      <div className="absolute -top-full -left-full w-[200%] h-[200%] animate-[shimmer_3s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent rotate-12" />
    </div>
  )
}

// Better empty state component
function EmptyState({ icon: Icon, title, description, action }: { icon: React.ElementType; title: string; description: string; action?: React.ReactNode }) {
  const accent = useVariantAccent()
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.08] flex items-center justify-center mb-4">
          <Icon className="w-10 h-10 text-slate-500/40" />
        </div>
        <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-br ${accent.avatarFrom} ${accent.avatarTo} animate-pulse`} />
        <div className={`absolute -bottom-1 -left-1 w-3 h-3 rounded-full bg-gradient-to-br ${accent.avatarFrom} ${accent.avatarTo} animate-pulse delay-500`} />
      </div>
      <h3 className="text-slate-300 font-medium mb-1">{title}</h3>
      <p className="text-slate-500 text-sm text-center max-w-xs">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

type ChronosData = import('@/stores/chronos-store').ChronosData

export function WalletPage() {
  const { user } = useAuth()
  const { data, isLoading, error, refresh, purchaseSlot, purchaseNameColor, purchaseTheme, giftChronos, claimDailyBonus, checkDailyBonus } = useChronos()
  const accent = useVariantAccent()
  const combo = useVariantCombo()
  const [activeTab, setActiveTab] = useState('overview')
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Daily bonus state
  const [dailyBonusStatus, setDailyBonusStatus] = useState<{ canClaim: boolean; nextClaimIn: string; amount: number }>({ canClaim: false, nextClaimIn: '', amount: 50 })
  const [isClaimingDaily, setIsClaimingDaily] = useState(false)

  // Gift state
  const [giftRecipient, setGiftRecipient] = useState('')
  const [giftAmount, setGiftAmount] = useState('')
  const [giftMessage, setGiftMessage] = useState('')
  const [isGifting, setIsGifting] = useState(false)
  const [giftError, setGiftError] = useState<string | null>(null)

  // Check daily bonus status on mount
  useEffect(() => {
    const check = async () => {
      const status = await checkDailyBonus()
      setDailyBonusStatus(status)
    }
    if (data) check()
  }, [data, checkDailyBonus])

  // Auto-dismiss success message
  useEffect(() => {
    if (successMessage) {
      const timeout = setTimeout(() => setSuccessMessage(null), 5000)
      return () => clearTimeout(timeout)
    }
  }, [successMessage])

  const handlePurchaseSlot = async () => {
    setPurchasing('slot')
    setSuccessMessage(null)
    const result = await purchaseSlot()
    setPurchasing(null)
    
    if (result.success) {
      if (result.isFirstPurchase) {
        setSuccessMessage(`🎉 First purchase bonus! You received ${result.bonusReceived} Chronos back!`)
      } else {
        setSuccessMessage('✅ Extra persona slot purchased!')
      }
    } else {
      alert(result.error || 'Failed to purchase slot')
    }
  }

  const handlePurchaseNameColor = async (color: string) => {
    setPurchasing(`color-${color}`)
    setSuccessMessage(null)
    const result = await purchaseNameColor(color)
    setPurchasing(null)
    
    if (result.success) {
      if (result.isFirstPurchase) {
        setSuccessMessage(`🎉 First purchase bonus! You received ${result.bonusReceived} Chronos back!`)
      } else {
        setSuccessMessage('✅ Name color updated!')
      }
    } else {
      alert(result.error || 'Failed to purchase name color')
    }
  }

  const handlePurchaseTheme = async (themeId: string) => {
    setPurchasing(`theme-${themeId}`)
    setSuccessMessage(null)
    const result = await purchaseTheme(themeId)
    setPurchasing(null)

    if (result.success) {
      if (result.isFirstPurchase) {
        setSuccessMessage(`🎉 First purchase bonus! You received ${result.bonusReceived} Chronos back!`)
      } else {
        setSuccessMessage('✅ Theme purchased!')
      }
    } else {
      alert(result.error || 'Failed to purchase theme')
    }
  }

  const handleClaimDailyBonus = async () => {
    setIsClaimingDaily(true)
    const result = await claimDailyBonus()
    setIsClaimingDaily(false)

    if (result.success) {
      setSuccessMessage(`☀️ Daily bonus claimed! +${result.amount} Chronos`)
      setDailyBonusStatus({ canClaim: false, nextClaimIn: '24h', amount: 50 })
    } else {
      // Already claimed - update status
      setDailyBonusStatus({ canClaim: result.canClaim ?? false, nextClaimIn: result.nextClaimIn ?? '', amount: 50 })
      if (result.error && result.error !== 'Already claimed today') {
        alert(result.error)
      }
    }
  }

  const handleGift = async () => {
    setGiftError(null)
    setIsGifting(true)

    const amount = parseInt(giftAmount, 10)
    if (isNaN(amount) || amount < 10) {
      setGiftError('Minimum gift amount is 10 Chronos')
      setIsGifting(false)
      return
    }

    if (amount > CHRONOS_PRICING.MAX_GIFT_AMOUNT) {
      setGiftError(`Maximum gift amount is ${CHRONOS_PRICING.MAX_GIFT_AMOUNT} Chronos at a time`)
      setIsGifting(false)
      return
    }

    if (!giftRecipient.trim()) {
      setGiftError('Please enter a recipient username')
      setIsGifting(false)
      return
    }

    const result = await giftChronos(giftRecipient.trim(), amount, giftMessage.trim() || undefined)

    setIsGifting(false)

    if (result.success) {
      setSuccessMessage(`🎁 Successfully gifted ${result.amount} Chronos to @${result.recipientUsername}!`)
      setGiftRecipient('')
      setGiftAmount('')
      setGiftMessage('')
      setActiveTab('overview')
    } else {
      setGiftError(result.error || 'Failed to send gift')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-red-400">{error}</p>
        <Button onClick={refresh} variant="outline">Retry</Button>
      </div>
    )
  }

  // Calculate earned achievements
  const earnedAchievements = ACHIEVEMENTS.filter(a => a.condition(data))

  return (
    <div className={`h-full flex flex-col bg-gradient-to-b from-[#0a1a1a] via-[#0d1117] to-[#0a1a1e]`}>
      {/* Shimmer keyframe animation */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%) translateY(-100%) rotate(12deg); }
          100% { transform: translateX(100%) translateY(100%) rotate(12deg); }
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 15px rgba(20, 184, 166, 0.2); }
          50% { box-shadow: 0 0 30px rgba(20, 184, 166, 0.4); }
        }
        @keyframes float-up {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-30px); }
        }
      `}</style>

      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-white/[0.08]">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${accent.from} ${accent.to} flex items-center justify-center shadow-lg ${accent.shadowGlow} animate-[glow-pulse_3s_ease-in-out_infinite]`}>
              <Wallet className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Chronos Wallet</h1>
              <p className="text-slate-500 text-sm">Manage your currency and purchases</p>
            </div>
          </div>

          {/* Balance Card with Animated Counter */}
          <div className={`mt-6 p-6 rounded-2xl bg-gradient-to-r ${accent.fromSubtle} ${accent.toSubtle} border ${accent.borderSubtle} relative overflow-hidden`}>
            <div className={`absolute inset-0 bg-gradient-to-r ${accent.fromSubtle} via-transparent ${accent.toSubtle}`} />
            <div className="relative flex items-center justify-between">
              <div>
                <p className={`${accent.text} text-sm font-medium opacity-70`}>Your Balance</p>
                <div className="flex items-center gap-3 mt-1">
                  <Clock className={`w-8 h-8 ${accent.text}`} />
                  <AnimatedCounter value={data?.chronos || 0} className={`text-4xl font-bold ${accent.text}`} />
                  <span className={`${accent.text} text-lg opacity-70`}>Chronos</span>
                </div>
              </div>
              {!data?.hasFirstPurchaseBonus && (
                <div className={`px-4 py-2 rounded-lg bg-gradient-to-r ${accent.fromSubtle} ${accent.toSubtle} border ${accent.borderMedium}`}>
                  <div className="flex items-center gap-2">
                    <Gift className={`w-5 h-5 ${accent.text}`} />
                    <span className={`${accent.text} font-medium text-sm`}>2x Bonus on First Purchase!</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <span className="text-emerald-300">{successMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-4xl mx-auto p-6 h-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="bg-white/[0.05] border border-white/[0.08] p-1">
              <TabsTrigger value="overview" className={`data-[state=active]:${accent.bgTint}`}>Overview</TabsTrigger>
              <TabsTrigger value="buy" className={`data-[state=active]:${accent.bgTint}`}>Buy Chronos</TabsTrigger>
              <TabsTrigger value="gift" className={`data-[state=active]:${accent.bgTint}`}>Gift</TabsTrigger>
              <TabsTrigger value="shop" className={`data-[state=active]:${accent.bgTint}`}>Shop</TabsTrigger>
              <TabsTrigger value="history" className={`data-[state=active]:${accent.bgTint}`}>History</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="flex-1 overflow-y-auto mt-4">
              <div className="grid gap-4">
                {/* Daily Bonus Section */}
                <Card className={`bg-gradient-to-br ${accent.fromSubtle} ${accent.toSubtle} ${accent.borderSubtle} overflow-hidden relative`}>
                  <div className={`absolute top-0 right-0 w-32 h-32 ${accent.bgSubtle} rounded-full -translate-y-1/2 translate-x-1/2`} />
                  <CardContent className="p-4 relative">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${accent.from} ${accent.to} flex items-center justify-center shadow-lg ${accent.shadowGlow}`}>
                          <Sun className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="text-white font-semibold">Daily Bonus</p>
                          <p className="text-slate-400 text-sm">
                            {dailyBonusStatus.canClaim
                              ? 'Claim your 50 Chronos daily bonus!'
                              : `Next bonus in ${dailyBonusStatus.nextClaimIn}`}
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={handleClaimDailyBonus}
                        disabled={!dailyBonusStatus.canClaim || isClaimingDaily}
                        className={`bg-gradient-to-r ${accent.from} ${accent.to} hover:${accent.from} hover:${accent.to} text-white font-semibold shadow-lg ${accent.shadowGlow} disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {isClaimingDaily ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : dailyBonusStatus.canClaim ? (
                          <Sun className="w-4 h-4 mr-2" />
                        ) : (
                          <Clock className="w-4 h-4 mr-2" />
                        )}
                        {dailyBonusStatus.canClaim ? 'Claim +50' : 'Claimed'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-white/[0.03] border-white/[0.08]">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${accent.bgTint} flex items-center justify-center`}>
                          <Crown className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs">Persona Slots</p>
                          <p className="text-white font-semibold">{data?.slots.used}/{data?.slots.total}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-white/[0.03] border-white/[0.08]">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${accent.bgHeavy} flex items-center justify-center`}>
                          <ImageIcon className={`w-5 h-5 ${accent.text}`} />
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs">Daily Images</p>
                          <p className="text-white font-semibold">{data?.dailyImagesUsed}/{data?.dailyImagesLimit}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Achievement Badges */}
                <Card className="bg-white/[0.03] border-white/[0.08]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg text-white flex items-center gap-2">
                      <Award className={`w-5 h-5 ${accent.text}`} />
                      Achievements
                      <span className="text-xs text-slate-500 font-normal">({earnedAchievements.length}/{ACHIEVEMENTS.length})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {ACHIEVEMENTS.map((achievement) => {
                        const earned = achievement.condition(data)
                        const Icon = achievement.icon
                        const achievementColor = achievement.id === 'first_purchase'
                          ? `from-emerald-500 ${accent.to}`
                          : achievement.color
                        return (
                          <div
                            key={achievement.id}
                            className={`p-3 rounded-xl border transition-all ${
                              earned
                                ? 'bg-white/[0.05] border-white/[0.12]'
                                : 'bg-white/[0.02] border-white/[0.05] opacity-40'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                earned
                                  ? `bg-gradient-to-br ${achievementColor}`
                                  : 'bg-white/[0.05]'
                              }`}>
                                <Icon className={`w-4 h-4 ${earned ? 'text-white' : 'text-slate-500'}`} />
                              </div>
                              <div>
                                <p className={`text-xs font-medium ${earned ? 'text-white' : 'text-slate-500'}`}>
                                  {achievement.name}
                                </p>
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-tight">{achievement.description}</p>
                            {earned && <Check className="w-3 h-3 text-emerald-400 mt-1" />}
                          </div>
                        )
                      })}
                    </div>
                    <button
                      onClick={() => window.dispatchEvent(new CustomEvent('chrona:open-achievements'))}
                      className={`mt-3 w-full py-2 rounded-lg border ${accent.borderSubtle} text-sm ${accent.text} hover:${accent.bgSubtle} transition-colors flex items-center justify-center gap-2`}
                    >
                      <Trophy className="w-4 h-4" />
                      View All Achievements
                    </button>
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card className="bg-white/[0.03] border-white/[0.08]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg text-white">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <button
                      onClick={handlePurchaseSlot}
                      disabled={purchasing === 'slot' || (data?.chronos || 0) < CHRONOS_PRICING.PERSONA_SLOT}
                      className="w-full p-4 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <Plus className="w-5 h-5 text-slate-400" />
                        <div className="text-left">
                          <p className="text-white font-medium">Buy Extra Persona Slot</p>
                          <p className="text-slate-500 text-xs">Permanent • 25 free slots included</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className={`w-4 h-4 ${accent.text}`} />
                        <span className={`${accent.text} font-semibold`}>{CHRONOS_PRICING.PERSONA_SLOT}</span>
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('shop')}
                      className="w-full p-4 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <Palette className="w-5 h-5 text-slate-400" />
                        <div className="text-left">
                          <p className="text-white font-medium">Browse Shop</p>
                          <p className="text-slate-500 text-xs">Themes, colors, and more</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-500" />
                    </button>
                  </CardContent>
                </Card>

                {/* Current Name Color */}
                {data?.nameColor && (
                  <Card className="bg-white/[0.03] border-white/[0.08]">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg text-white">Your Name Color</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-lg border-2"
                          style={{ backgroundColor: data.nameColor, borderColor: data.nameColor }}
                        />
                        <span className="text-white font-medium" style={{ color: data.nameColor }}>
                          {user?.username}
                        </span>
                        <span className="text-slate-500 text-sm">• Active globally</span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Buy Chronos Tab */}
            <TabsContent value="buy" className="flex-1 overflow-y-auto mt-4">
              <div className="space-y-6">
                {/* First Purchase Bonus Banner */}
                {!data?.hasFirstPurchaseBonus && (
                  <div className={`p-4 rounded-xl bg-gradient-to-r ${accent.fromSubtle} ${accent.toSubtle} border ${accent.borderMedium}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${accent.from} ${accent.to} flex items-center justify-center`}>
                        <Gift className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className={`${accent.text} font-semibold`}>🎉 First Purchase Bonus!</p>
                        <p className={`${accent.text} text-sm opacity-70`}>Your first purchase will give you DOUBLE the value back as bonus Chronos!</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Chronos Packs with shimmer/glow */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <Zap className={`w-5 h-5 ${accent.text}`} />
                    Chronos Packs
                  </h3>
                  <p className="text-slate-500 text-sm mb-4">
                    Purchase Chronos to unlock premium features, extra slots, and customization options. Max {CHRONOS_PRICING.MAX_PURCHASE_AMOUNT} Chronos per purchase.
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    {CHRONOS_PACKS.map((pack) => (
                      <button
                        key={pack.id}
                        className={`p-4 rounded-xl border transition-all group relative overflow-hidden ${
                          pack.recommended
                            ? `bg-gradient-to-b ${accent.bgTint} ${accent.toSubtle} ${accent.borderMedium} hover:${accent.borderStrong} shadow-lg ${accent.shadowGlow}`
                            : `bg-gradient-to-b from-white/[0.05] ${accent.toSubtle} border-white/[0.08] hover:${accent.borderMedium} hover:${accent.fromSubtle} hover:${accent.toSubtle}`
                        }`}
                      >
                        <ShimmerOverlay />
                        
                        {/* Recommended badge */}
                        {pack.recommended && (
                          <div className={`absolute top-0 left-0 right-0 bg-gradient-to-r ${accent.from} ${accent.to} text-white text-xs font-bold px-3 py-1 text-center`}>
                            ⭐ RECOMMENDED
                          </div>
                        )}

                        {/* Bonus badge */}
                        {pack.bonus > 0 && !pack.recommended && (
                          <div className={`absolute top-0 right-0 bg-gradient-to-r ${accent.from} ${accent.to} text-white text-xs font-bold px-2 py-0.5 rounded-bl-lg`}>
                            +{pack.bonus} BONUS
                          </div>
                        )}

                        <div className={`flex items-center justify-center gap-2 mb-2 ${pack.recommended ? 'mt-5' : ''}`}>
                          <Clock className={`w-6 h-6 ${accent.text} group-hover:scale-110 transition-transform`} />
                          <span className={`text-2xl font-bold ${accent.text}`}>{(pack.chronos + pack.bonus).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-300 text-sm text-center">Chronos</p>
                        <div className={`mt-3 py-2 rounded-lg transition-colors ${
                          pack.recommended 
                            ? `${accent.bgHeavy} group-hover:${accent.bgHeavy}` 
                            : `${accent.bgTint} group-hover:${accent.bgHeavy}`
                        }`}>
                          <span className="text-white font-semibold">{pack.price}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* What can you do section */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">What Can You Do With Chronos?</h3>
                  <div className="grid gap-3">
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl ${accent.bgTint} flex items-center justify-center flex-shrink-0`}>
                        <Plus className="w-6 h-6 text-slate-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium">Extra Persona Slots</p>
                        <p className="text-slate-500 text-sm">200 Chronos per slot • Permanent</p>
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl ${accent.bgHeavy} flex items-center justify-center flex-shrink-0`}>
                        <Crown className={`w-6 h-6 ${accent.text}`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium">Create Storylines</p>
                        <p className="text-slate-500 text-sm">500 Chronos • Create your own server</p>
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center flex-shrink-0">
                        <Palette className="w-6 h-6 text-pink-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium">Name Colors</p>
                        <p className="text-slate-500 text-sm">300 Chronos • Stand out everywhere</p>
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl ${accent.bgHeavy} flex items-center justify-center flex-shrink-0`}>
                        <Sparkles className={`w-6 h-6 ${accent.text}`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium">Profile Themes</p>
                        <p className="text-slate-500 text-sm">100-300 Chronos • Customize your character profiles</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Gift Tab */}
            <TabsContent value="gift" className="flex-1 overflow-y-auto mt-4">
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg shadow-pink-500/25">
                    <Gift className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Gift Chronos</h3>
                    <p className="text-slate-500 text-sm">Send Chronos to friends with an optional message</p>
                  </div>
                </div>

                {/* Gift Form */}
                <Card className="bg-white/[0.03] border-white/[0.08]">
                  <CardContent className="p-6 space-y-5">
                    {/* Current Balance */}
                    <div className={`flex items-center justify-between p-3 rounded-xl ${accent.bgSubtle} border ${accent.borderSubtle}`}>
                      <span className={`${accent.text} text-sm opacity-80`}>Your Balance</span>
                      <div className="flex items-center gap-2">
                        <Clock className={`w-4 h-4 ${accent.text}`} />
                        <span className={`${accent.text} font-semibold`}>{data?.chronos.toLocaleString() || 0}</span>
                      </div>
                    </div>

                    {/* Error Message */}
                    {giftError && (
                      <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                        {giftError}
                      </div>
                    )}

                    {/* Recipient */}
                    <div className="space-y-2">
                      <label className="text-sm text-slate-300/80 font-medium flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Recipient Username
                      </label>
                      <input
                        type="text"
                        value={giftRecipient}
                        onChange={(e) => setGiftRecipient(e.target.value)}
                        placeholder="Enter username..."
                        className={`w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white placeholder-slate-500/40 focus:outline-none focus:${accent.borderMedium} transition-colors`}
                      />
                    </div>

                    {/* Amount */}
                    <div className="space-y-2">
                      <label className="text-sm text-slate-300/80 font-medium flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Amount
                      </label>
                      <input
                        type="number"
                        value={giftAmount}
                        onChange={(e) => setGiftAmount(e.target.value)}
                        placeholder={`Min 10, Max ${CHRONOS_PRICING.MAX_GIFT_AMOUNT} Chronos`}
                        min={10}
                        max={CHRONOS_PRICING.MAX_GIFT_AMOUNT}
                        className={`w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white placeholder-slate-500/40 focus:outline-none focus:${accent.borderMedium} transition-colors`}
                      />
                      {/* Quick amounts */}
                      <div className="flex gap-2 flex-wrap">
                        {[50, 100, 250, 500, 1000].map((amount) => (
                          <button
                            key={amount}
                            onClick={() => setGiftAmount(amount.toString())}
                            disabled={(data?.chronos || 0) < amount}
                            className={`px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-slate-300 text-sm hover:${accent.bgTint} transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {amount}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Message (Optional) */}
                    <div className="space-y-2">
                      <label className="text-sm text-slate-300/80 font-medium flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Message <span className="text-slate-500 font-normal">(Optional)</span>
                      </label>
                      <textarea
                        value={giftMessage}
                        onChange={(e) => setGiftMessage(e.target.value.slice(0, 200))}
                        placeholder="Add a personal message..."
                        rows={3}
                        className={`w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white placeholder-slate-500/40 focus:outline-none focus:${accent.borderMedium} transition-colors resize-none`}
                      />
                      <p className="text-xs text-slate-500 text-right">{giftMessage.length}/200</p>
                    </div>

                    {/* Send Button */}
                    <Button
                      onClick={handleGift}
                      disabled={isGifting || !giftRecipient.trim() || !giftAmount || parseInt(giftAmount) < 10 || parseInt(giftAmount) > CHRONOS_PRICING.MAX_GIFT_AMOUNT || (data?.chronos || 0) < parseInt(giftAmount || '0')}
                      className="w-full bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-semibold py-6 rounded-xl shadow-lg shadow-pink-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGifting ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Sending Gift...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Send className="w-5 h-5" />
                          <span>Send Gift</span>
                          {giftAmount && parseInt(giftAmount) >= 10 && (
                            <span className="ml-1">({parseInt(giftAmount).toLocaleString()} Chronos)</span>
                          )}
                        </div>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Info Card */}
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                    <Star className={`w-4 h-4 ${accent.text}`} />
                    How Gifting Works
                  </h4>
                  <ul className="text-sm text-slate-300/70 space-y-1.5">
                    <li>• Chronos are transferred directly to the recipient</li>
                    <li>• Minimum gift amount is 10 Chronos</li>
                    <li>• Maximum gift amount is {CHRONOS_PRICING.MAX_GIFT_AMOUNT} Chronos at a time</li>
                    <li>• The recipient will receive a notification</li>
                    <li>• Gifts cannot be reversed once sent</li>
                  </ul>
                </div>
              </div>
            </TabsContent>

            {/* Shop Tab */}
            <TabsContent value="shop" className="flex-1 overflow-y-auto mt-4 space-y-6">
              {/* Name Colors */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Palette className="w-5 h-5 text-slate-400" />
                  Name Colors
                </h3>
                <p className="text-slate-500 text-sm mb-3">
                  Your name will appear in this color everywhere • {CHRONOS_PRICING.NAME_COLOR} Chronos each
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {NAME_COLORS.map(({ name, color }) => (
                    <button
                      key={color}
                      onClick={() => handlePurchaseNameColor(color)}
                      disabled={purchasing === `color-${color}` || (data?.chronos || 0) < CHRONOS_PRICING.NAME_COLOR}
                      className={`p-3 rounded-xl border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        data?.nameColor === color 
                          ? `${accent.bgTint} ${accent.borderMedium}` 
                          : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.05]'
                      }`}
                    >
                      <div 
                        className="w-full aspect-square rounded-lg mb-2 flex items-center justify-center"
                        style={{ backgroundColor: color }}
                      >
                        {data?.nameColor === color && <Check className="w-5 h-5 text-white" />}
                      </div>
                      <p className="text-xs text-white truncate">{name}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Profile Themes */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-slate-400" />
                  Profile Themes
                </h3>
                <p className="text-slate-500 text-sm mb-3">
                  Apply beautiful themes to your character profiles
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {THEME_PRESETS.map((theme) => {
                    const isOwned = data?.ownedThemes.includes(theme.id)
                    return (
                      <button
                        key={theme.id}
                        onClick={() => !isOwned && handlePurchaseTheme(theme.id)}
                        disabled={purchasing === `theme-${theme.id}` || (!isOwned && (data?.chronos || 0) < theme.price)}
                        className={`p-3 rounded-xl border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                          isOwned 
                            ? 'bg-emerald-500/10 border-emerald-500/30' 
                            : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.05]'
                        }`}
                      >
                        <div 
                          className="w-full aspect-video rounded-lg mb-2 flex items-center justify-center relative overflow-hidden"
                          style={{ background: theme.background }}
                        >
                          {isOwned && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <Check className="w-6 h-6 text-white" />
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-white font-medium">{theme.name}</p>
                        <div className="flex items-center justify-between mt-1">
                          {isOwned ? (
                            <span className="text-xs text-emerald-400">Owned</span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Clock className={`w-3 h-3 ${accent.text}`} />
                              <span className={`text-xs ${accent.text}`}>{theme.price}</span>
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="flex-1 overflow-hidden mt-4">
              <Card className="bg-white/[0.03] border-white/[0.08] h-full">
                <CardHeader>
                  <CardTitle className="text-lg text-white">Transaction History</CardTitle>
                  <CardDescription>Your recent Chronos activity</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    {data?.transactions.length === 0 ? (
                      <EmptyState
                        icon={ArrowDownUp}
                        title="No Transactions Yet"
                        description="Your transaction history will appear here once you start earning or spending Chronos."
                        action={
                          <Button variant="outline" onClick={() => setActiveTab('buy')} className="text-slate-300 border-white/[0.08]">
                            <Zap className="w-4 h-4 mr-2" /> Get Chronos
                          </Button>
                        }
                      />
                    ) : (
                      <div className="space-y-2">
                        {data?.transactions.map((tx) => {
                          const config = getCategoryConfig(tx.category, tx.type, accent)
                          const Icon = config.icon
                          return (
                            <div 
                              key={tx.id}
                              className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center gap-3 hover:bg-white/[0.05] transition-colors"
                            >
                              <div className={`w-9 h-9 rounded-lg ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
                                <Icon className={`w-4 h-4 ${config.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-white text-sm font-medium truncate">{tx.description}</p>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${config.bgColor} ${config.color}`}>
                                    {config.label}
                                  </span>
                                  <p className="text-slate-500 text-xs">
                                    {formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true })}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className={`font-semibold ${tx.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {tx.amount > 0 ? '+' : ''}{tx.amount}
                                </p>
                                <p className="text-slate-500 text-xs">Bal: {tx.balance}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
