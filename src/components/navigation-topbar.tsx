'use client'

import { useAuth } from '@/hooks/use-auth'
import { usePersonas } from '@/hooks/use-personas'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  MessageCircle, Shield, Compass, Users,
  Crown, Trophy, ShoppingBag, Wallet
} from 'lucide-react'
import { ProfileDropdown } from '@/components/profile-dropdown'

interface NavigationTopbarProps {
  activeItem?: string
  onNavigate?: (item: string) => void
  onOpenEditProfile?: () => void
  onOpenMyPersonas?: () => void
  onOpenFindUsers?: () => void
  variant?: 'default' | 'inside-banner'
}

export function NavigationTopbar({ activeItem = 'discover', onNavigate, onOpenEditProfile, onOpenMyPersonas, onOpenFindUsers, variant = 'default' }: NavigationTopbarProps) {
  const { user } = useAuth()
  const { activePersona } = usePersonas()

  const navItems = [
    { id: 'discover', label: 'Discover', icon: Compass },
    { id: 'friends', label: 'Friends', icon: Users },
    { id: 'storylines', label: 'Storylines', icon: Crown },
    { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
    { id: 'chronos', label: 'Chronos', icon: Wallet },
    { id: 'achievements', label: 'Achievements', icon: Trophy },
  ]

  // Inside-banner variant: floating glassmorphism bar centered with margin
  if (variant === 'inside-banner') {
    return (
      <div className="mx-auto max-w-7xl w-[calc(100%-3rem)] flex items-center justify-between px-5 py-2.5 rounded-xl bg-black/40 backdrop-blur-xl border border-white/[0.08] shadow-lg shadow-black/20">
        {/* Left: Logo */}
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Chrona" className="w-7 h-7 rounded-lg object-cover" />
          <span className="text-sm font-semibold text-slate-100 tracking-tight">Chrona</span>
        </div>

        {/* Center: Navigation */}
        <div className="flex items-center gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => onNavigate?.(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
                  activeItem === item.id
                    ? 'text-teal-400 bg-teal-500/10'
                    : 'text-slate-300/80 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            )
          })}
          {/* Admin - Only visible to staff */}
          {user && ['mod', 'admin', 'owner'].includes(user.role) && (
            <button
              onClick={() => onNavigate?.('admin')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
                activeItem === 'admin'
                  ? 'text-amber-400 bg-amber-500/10'
                  : 'text-slate-300/80 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Admin
            </button>
          )}
        </div>

        {/* Right: Chat bubble (opens Find Users) + Avatar (opens ProfileDropdown) */}
        <div className="flex items-center gap-3">
          {/* Chat bubble - opens Find Users modal */}
          <button
            onClick={() => onOpenFindUsers?.()}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-teal-400 hover:bg-white/[0.06] transition-all"
            title="Find Users"
          >
            <MessageCircle className="w-4 h-4" />
          </button>

          {/* Avatar - opens Profile Dropdown */}
          <ProfileDropdown
            onNavigate={onNavigate}
            onOpenEditProfile={onOpenEditProfile}
            onOpenMyPersonas={onOpenMyPersonas}
            position="bottom-right"
            trigger={
              <div className="relative w-8 h-8 rounded-full overflow-hidden transition-all ring-2 ring-white/10 hover:ring-teal-500/40 cursor-pointer">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user?.avatarUrl || activePersona?.avatarUrl || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-teal-500 to-cyan-500 text-white text-xs font-semibold">
                    {(user?.username || activePersona?.name || 'U').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
            }
          />
        </div>
      </div>
    )
  }

  // Default variant: full width top bar (for non-banner contexts)
  return (
    <div className="h-12 flex items-center justify-between px-4 bg-[#0b0d11]/75 backdrop-blur-xl border-b border-white/[0.06] flex-shrink-0">
      {/* Left: Logo */}
      <div className="flex items-center gap-2.5">
        <img src="/logo.png" alt="Chrona" className="w-7 h-7 rounded-lg object-cover" />
        <span className="text-sm font-semibold text-slate-100 tracking-tight">Chrona</span>
      </div>

      {/* Center: Navigation */}
      <div className="flex items-center gap-0.5">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => onNavigate?.(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
                activeItem === item.id
                  ? 'text-teal-400 bg-teal-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          )
        })}
        {/* Admin - Only visible to staff */}
        {user && ['mod', 'admin', 'owner'].includes(user.role) && (
          <button
            onClick={() => onNavigate?.('admin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
              activeItem === 'admin'
                ? 'text-amber-400 bg-amber-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Admin
          </button>
        )}
      </div>

      {/* Right: Chat (opens Find Users) + Avatar (opens ProfileDropdown) */}
      <div className="flex items-center gap-2">
        {/* Chat bubble - opens Find Users modal */}
        <button
          onClick={() => onOpenFindUsers?.()}
          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-teal-400 hover:bg-white/[0.06] transition-all"
          title="Find Users"
        >
          <MessageCircle className="w-4 h-4" />
        </button>

        {/* Avatar - opens Profile Dropdown */}
        <ProfileDropdown
          onNavigate={onNavigate}
          onOpenEditProfile={onOpenEditProfile}
          onOpenMyPersonas={onOpenMyPersonas}
          position="bottom-right"
          trigger={
            <div className="relative w-8 h-8 rounded-full overflow-hidden transition-all ring-2 ring-white/10 hover:ring-teal-500/40 cursor-pointer">
              <Avatar className="w-8 h-8">
                <AvatarImage src={user?.avatarUrl || activePersona?.avatarUrl || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-teal-500 to-cyan-500 text-white text-xs font-semibold">
                  {(user?.username || activePersona?.name || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          }
        />
      </div>
    </div>
  )
}
