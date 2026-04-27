'use client'

import { create } from 'zustand'

// 6 Layout variants - each is a completely different UI structure
export type UIVariant = 'chrona' | 'chrona-v2' | 'chrona-v3' | 'horizon' | 'pulse' | 'nexus'

interface UIVariantState {
  variant: UIVariant
  setVariant: (variant: UIVariant) => void
}

const STORAGE_KEY = 'chrona-ui-variant'

const VALID_VARIANTS: UIVariant[] = ['chrona', 'chrona-v2', 'chrona-v3', 'horizon', 'pulse', 'nexus']

function getInitialVariant(): UIVariant {
  if (typeof window === 'undefined') return 'chrona'
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && VALID_VARIANTS.includes(stored as UIVariant)) {
      return stored as UIVariant
    }
    // Migrate old variants to chrona
    if (['neon-cyber', 'aurora', 'retro-terminal', 'minimal', 'bold', 'elegant'].includes(stored || '')) {
      localStorage.setItem(STORAGE_KEY, 'chrona')
    }
  } catch {}
  return 'chrona'
}

export const useUIVariant = create<UIVariantState>((set) => ({
  variant: 'chrona',
  setVariant: (variant: UIVariant) => {
    try {
      localStorage.setItem(STORAGE_KEY, variant)
    } catch {}
    
    // Apply UI variant class to document
    if (typeof document !== 'undefined') {
      const root = document.documentElement
      // Remove all UI variant classes
      root.classList.remove('ui-chrona', 'ui-chrona-v2', 'ui-chrona-v3', 'ui-horizon', 'ui-pulse', 'ui-nexus', 'ui-minimal', 'ui-bold', 'ui-elegant', 'ui-neon-cyber', 'ui-aurora', 'ui-retro-terminal')
      // Add the new one
      root.classList.add(`ui-${variant}`)
      
      // Dispatch custom event so other components can react
      window.dispatchEvent(new CustomEvent('chrona:ui-variant-changed', { detail: { variant } }))
    }
    
    set({ variant })
  },
}))

// Initialize on client side
if (typeof window !== 'undefined') {
  const initial = getInitialVariant()
  // Apply immediately
  const root = document.documentElement
  root.classList.remove('ui-chrona', 'ui-chrona-v2', 'ui-chrona-v3', 'ui-horizon', 'ui-pulse', 'ui-nexus', 'ui-minimal', 'ui-bold', 'ui-elegant', 'ui-neon-cyber', 'ui-aurora', 'ui-retro-terminal')
  root.classList.add(`ui-${initial}`)
  useUIVariant.setState({ variant: initial })
}

export const UI_VARIANT_INFO: Record<UIVariant, { 
  name: string
  description: string
  accent: string
  icon: string
  accentColor: string
  accentBg: string
  accentBorder: string
  accentText: string
}> = {
  'chrona': {
    name: 'Chrona V1',
    description: 'Classic sidebar layout with glassmorphism',
    accent: 'Teal/Cyan',
    icon: '🌊',
    accentColor: 'bg-teal-500',
    accentBg: 'bg-teal-500/10',
    accentBorder: 'border-teal-500/20',
    accentText: 'text-teal-400',
  },
  'chrona-v2': {
    name: 'Chrona V2',
    description: 'Modern floating dock with streamlined panels',
    accent: 'Violet/Purple',
    icon: '🔮',
    accentColor: 'bg-violet-500',
    accentBg: 'bg-violet-500/10',
    accentBorder: 'border-violet-500/20',
    accentText: 'text-violet-400',
  },
  'chrona-v3': {
    name: 'Chrona V3',
    description: 'Minimal zen layout with centered content',
    accent: 'Rose/Pink',
    icon: '🌸',
    accentColor: 'bg-rose-500',
    accentBg: 'bg-rose-500/10',
    accentBorder: 'border-rose-500/20',
    accentText: 'text-rose-400',
  },
  'horizon': {
    name: 'Horizon',
    description: 'Clean top-nav SaaS style with centered content',
    accent: 'Steel/Blue',
    icon: '✦',
    accentColor: 'bg-blue-500',
    accentBg: 'bg-blue-500/10',
    accentBorder: 'border-blue-500/20',
    accentText: 'text-blue-400',
  },
  'pulse': {
    name: 'Pulse',
    description: 'Social feed style with bottom navigation',
    accent: 'Coral/Orange',
    icon: '◆',
    accentColor: 'bg-orange-500',
    accentBg: 'bg-orange-500/10',
    accentBorder: 'border-orange-500/20',
    accentText: 'text-orange-400',
  },
  'nexus': {
    name: 'Nexus',
    description: 'Power-user split-panel dashboard',
    accent: 'Amber/Gold',
    icon: '❖',
    accentColor: 'bg-amber-500',
    accentBg: 'bg-amber-500/10',
    accentBorder: 'border-amber-500/20',
    accentText: 'text-amber-400',
  },
}
