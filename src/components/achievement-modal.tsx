'use client'

import React, { useState, useEffect, useCallback, startTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { apiJson } from '@/lib/api-client'
import { CATEGORY_INFO, TIER_INFO, type AchievementCategory } from '@/lib/achievements'
import { Trophy, Lock, Sparkles, Loader2 } from 'lucide-react'
import { useVariantAccent } from '@/lib/ui-variant-styles'

// Types
interface Achievement {
  id: string
  key: string
  name: string
  description: string
  icon: string
  category: string
  tier: number
  requirement: number
  isHidden: boolean
  isActive: boolean
  userProgress: number
  userCompleted: boolean
  userCompletedAt: string | null
  isSecret: boolean
}

interface AchievementsResponse {
  achievements: Achievement[]
  stats: {
    total: number
    completed: number
  }
}

interface AchievementModalProps {
  isOpen: boolean
  onClose: () => void
}

// Achievement card component
function AchievementCard({ achievement }: { achievement: Achievement }) {
  const accent = useVariantAccent()
  const isCompleted = achievement.userCompleted
  const progressPercent = Math.min(
    (achievement.userProgress / achievement.requirement) * 100,
    100
  )
  const isLocked = !isCompleted
  const categoryInfo = CATEGORY_INFO[achievement.category as AchievementCategory]
  const tierInfo = TIER_INFO[achievement.tier]

  // Secret (hidden) achievement that's not yet unlocked
  if (achievement.isSecret) {
    return (
      <div className="relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 opacity-50">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-white/[0.05] flex items-center justify-center text-2xl grayscale blur-[2px]">
            ❓
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-slate-500 text-sm">Hidden Achievement</h4>
            <p className="text-xs text-slate-600 mt-0.5">Keep exploring to discover...</p>
          </div>
          <Lock className="w-4 h-4 text-slate-600" />
        </div>
      </div>
    )
  }

  return (
    <div
      className={`relative rounded-xl border p-4 transition-all duration-300 ${
        isCompleted
          ? `${accent.borderMedium} bg-gradient-to-br ${accent.fromSubtle} ${accent.toSubtle} shadow-[0_0_20px_rgba(20,184,166,0.08)]`
          : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
      }`}
    >
      {/* Glow effect for completed achievements */}
      {isCompleted && (
        <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${accent.fromSubtle} ${accent.toSubtle} pointer-events-none`} />
      )}

      <div className="relative flex items-start gap-3">
        {/* Icon */}
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl flex-shrink-0 ${
            isCompleted
              ? `bg-gradient-to-br ${accent.fromSubtle} ${accent.toSubtle} shadow-[0_0_12px_rgba(20,184,166,0.2)]`
              : 'bg-white/[0.05]'
          }`}
        >
          {achievement.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4
              className={`font-semibold text-sm ${
                isCompleted ? accent.text : 'text-slate-200'
              }`}
            >
              {achievement.name}
            </h4>
            {/* Tier badge */}
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                isCompleted
                  ? `${accent.bgHeavy} ${accent.text} border ${accent.borderMedium}`
                  : 'bg-white/[0.05] text-slate-500 border border-white/[0.08]'
              }`}
            >
              {tierInfo?.label || `T${achievement.tier}`}
            </span>
          </div>

          <p className={`text-xs mt-0.5 ${isCompleted ? 'text-slate-400' : 'text-slate-500'}`}>
            {achievement.description}
          </p>

          {/* Progress bar */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-500">
                {achievement.userProgress}/{achievement.requirement}
              </span>
              <span className="text-[10px] text-slate-500">
                {Math.round(progressPercent)}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isCompleted
                    ? `bg-gradient-to-r ${accent.from} ${accent.to} shadow-[0_0_8px_rgba(20,184,166,0.4)]`
                    : 'bg-gradient-to-r from-slate-600 to-slate-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Completed indicator */}
          {isCompleted && achievement.userCompletedAt && (
            <div className="mt-1.5 flex items-center gap-1">
              <Sparkles className={`w-3 h-3 ${accent.text}`} />
              <span className={`text-[10px] ${accent.textDim}`}>
                Unlocked {new Date(achievement.userCompletedAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {/* Lock icon for incomplete */}
        {isLocked && (
          <div className="flex-shrink-0">
            <Lock className="w-4 h-4 text-slate-600" />
          </div>
        )}
      </div>
    </div>
  )
}

export function AchievementModal({ isOpen, onClose }: AchievementModalProps) {
  const accent = useVariantAccent()
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [stats, setStats] = useState({ total: 0, completed: 0 })
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [newlyEarned, setNewlyEarned] = useState<string[]>([])

  // Fetch achievements
  const fetchAchievements = useCallback(async () => {
    setIsLoading(true)
    try {
      // First, trigger a check for all categories
      const checkRes = await apiJson<{ success: boolean; newlyEarned: string[]; count: number }>(
        '/api/achievements',
        {
          method: 'POST',
          body: JSON.stringify({}),
        }
      )

      if (checkRes.newlyEarned && checkRes.newlyEarned.length > 0) {
        setNewlyEarned(checkRes.newlyEarned)
        // Clear after 5 seconds
        setTimeout(() => setNewlyEarned([]), 5000)
      }

      // Then fetch all achievements
      const data = await apiJson<AchievementsResponse>('/api/achievements')
      setAchievements(data.achievements)
      setStats(data.stats)
    } catch (error) {
      console.error('[AchievementModal] Failed to fetch achievements:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      startTransition(() => { fetchAchievements() })
    }
  }, [isOpen, fetchAchievements])

  // Filter achievements by category
  const filteredAchievements =
    activeCategory === 'all'
      ? achievements
      : achievements.filter((a) => a.category === activeCategory)

  // Category filter tabs
  const categories: { key: string; label: string; emoji: string }[] = [
    { key: 'all', label: 'All', emoji: '🏆' },
    ...Object.entries(CATEGORY_INFO).map(([key, info]) => ({
      key,
      label: info.label,
      emoji: info.emoji,
    })),
  ]

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={`sm:max-w-3xl h-[65vh] overflow-hidden flex flex-col ${accent.bgSurfaceDeep} border-white/[0.08]`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${accent.from} ${accent.to} flex items-center justify-center shadow-[0_0_12px_rgba(20,184,166,0.3)]`}>
              <Trophy className="w-4 h-4 text-white" />
            </div>
            <span className="persona-gradient-text">Achievements</span>
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            Track your progress and earn badges as you explore Chrona
          </DialogDescription>
        </DialogHeader>

        {/* Stats bar */}
        <div className={`flex items-center gap-4 p-3 rounded-xl bg-gradient-to-r ${accent.fromSubtle} ${accent.toSubtle} border ${accent.borderSubtle}`}>
          <Trophy className={`w-5 h-5 ${accent.text}`} />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className={`text-sm font-medium ${accent.text}`}>
                {stats.completed}/{stats.total} Achievements Unlocked
              </span>
              <span className="text-xs text-slate-500">
                {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
              </span>
            </div>
            <Progress
              value={stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}
              className="mt-1.5 h-2 bg-white/[0.06]"
            />
          </div>
        </div>

        {/* New achievements notification */}
        {newlyEarned.length > 0 && (
          <div className={`flex items-center gap-2 p-3 rounded-xl bg-gradient-to-r ${accent.fromSubtle} ${accent.toSubtle} border ${accent.borderMedium} animate-pulse`}>
            <Sparkles className={`w-5 h-5 ${accent.text}`} />
            <span className={`text-sm ${accent.text} font-medium`}>
              🎉 {newlyEarned.length} new achievement{newlyEarned.length > 1 ? 's' : ''} unlocked!
            </span>
          </div>
        )}

        {/* Category filter */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeCategory === cat.key
                  ? `${accent.bgHeavy} ${accent.text} border ${accent.borderMedium} shadow-[0_0_8px_rgba(20,184,166,0.1)]`
                  : 'bg-white/[0.03] text-slate-400 border border-white/[0.06] hover:bg-white/[0.06] hover:text-slate-300'
              }`}
            >
              <span>{cat.emoji}</span>
              {cat.label}
            </button>
          ))}
        </div>

        {/* Achievement grid */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className={`w-8 h-8 animate-spin ${accent.textDim}`} />
            </div>
          ) : filteredAchievements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Trophy className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">No achievements in this category yet</p>
            </div>
          ) : (
            <div className="grid gap-3 pr-1 pb-4">
              {filteredAchievements.map((achievement) => (
                <AchievementCard key={achievement.id} achievement={achievement} />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
