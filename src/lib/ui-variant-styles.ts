'use client'

import { useUIVariant, type UIVariant } from '@/stores/ui-variant-store'

/**
 * Variant-specific Tailwind class mappings.
 * Each layout variant maps to a different color palette:
 * - chrona: teal/cyan (default sidebar layout)
 * - horizon: blue/steel (top-nav SaaS layout)
 * - pulse: orange/coral (social feed layout)
 * - nexus: amber/gold (power-user dashboard layout)
 */

export interface VariantAccentClasses {
  text: string
  textDim: string
  bgTint: string
  bgSolid: string
  bgSubtle: string
  bgHeavy: string
  borderSubtle: string
  borderMedium: string
  borderStrong: string
  ringFocus: string
  ringColor: string
  from: string
  to: string
  fromSubtle: string
  toSubtle: string
  shadowGlow: string
  avatarFrom: string
  avatarTo: string
  avatarBorder: string
  onlineBg: string
  successBg: string
  successText: string
  successBorder: string
  bgSurface: string
  bgSurfaceDeep: string
}

const VARIANT_ACCENTS: Record<UIVariant, VariantAccentClasses> = {
  chrona: {
    text: 'text-teal-400',
    textDim: 'text-teal-500',
    bgTint: 'bg-teal-500/15',
    bgSolid: 'bg-teal-500',
    bgSubtle: 'bg-teal-500/10',
    bgHeavy: 'bg-teal-500/20',
    borderSubtle: 'border-teal-500/20',
    borderMedium: 'border-teal-500/30',
    borderStrong: 'border-teal-400',
    ringFocus: 'ring-teal-400/40',
    ringColor: 'ring-teal-400',
    from: 'from-teal-500',
    to: 'to-cyan-400',
    fromSubtle: 'from-teal-500/20',
    toSubtle: 'to-cyan-500/10',
    shadowGlow: 'shadow-teal-500/20',
    avatarFrom: 'from-teal-500/40',
    avatarTo: 'to-cyan-500/50',
    avatarBorder: 'border-teal-500/20',
    onlineBg: 'bg-emerald-500',
    successBg: 'bg-emerald-500/10',
    successText: 'text-emerald-400',
    successBorder: 'border-emerald-500/20',
    bgSurface: 'bg-[#0f1117]',
    bgSurfaceDeep: 'bg-[#0b0d11]',
  },
  'chrona-v2': {
    text: 'text-violet-400',
    textDim: 'text-violet-500',
    bgTint: 'bg-violet-500/15',
    bgSolid: 'bg-violet-500',
    bgSubtle: 'bg-violet-500/10',
    bgHeavy: 'bg-violet-500/20',
    borderSubtle: 'border-violet-500/20',
    borderMedium: 'border-violet-500/30',
    borderStrong: 'border-violet-400',
    ringFocus: 'ring-violet-400/40',
    ringColor: 'ring-violet-400',
    from: 'from-violet-500',
    to: 'to-purple-400',
    fromSubtle: 'from-violet-500/20',
    toSubtle: 'to-purple-500/10',
    shadowGlow: 'shadow-violet-500/20',
    avatarFrom: 'from-violet-500/40',
    avatarTo: 'to-purple-500/50',
    avatarBorder: 'border-violet-500/20',
    onlineBg: 'bg-emerald-500',
    successBg: 'bg-emerald-500/10',
    successText: 'text-emerald-400',
    successBorder: 'border-emerald-500/20',
    bgSurface: 'bg-[#0f0d14]',
    bgSurfaceDeep: 'bg-[#0b0a10]',
  },
  'chrona-v3': {
    text: 'text-rose-400',
    textDim: 'text-rose-500',
    bgTint: 'bg-rose-500/15',
    bgSolid: 'bg-rose-500',
    bgSubtle: 'bg-rose-500/10',
    bgHeavy: 'bg-rose-500/20',
    borderSubtle: 'border-rose-500/20',
    borderMedium: 'border-rose-500/30',
    borderStrong: 'border-rose-400',
    ringFocus: 'ring-rose-400/40',
    ringColor: 'ring-rose-400',
    from: 'from-rose-500',
    to: 'to-pink-400',
    fromSubtle: 'from-rose-500/20',
    toSubtle: 'to-pink-500/10',
    shadowGlow: 'shadow-rose-500/20',
    avatarFrom: 'from-rose-500/40',
    avatarTo: 'to-pink-500/50',
    avatarBorder: 'border-rose-500/20',
    onlineBg: 'bg-emerald-500',
    successBg: 'bg-emerald-500/10',
    successText: 'text-emerald-400',
    successBorder: 'border-emerald-500/20',
    bgSurface: 'bg-[#110d0f]',
    bgSurfaceDeep: 'bg-[#0d0a0b]',
  },
  horizon: {
    text: 'text-blue-400',
    textDim: 'text-blue-500',
    bgTint: 'bg-blue-500/15',
    bgSolid: 'bg-blue-500',
    bgSubtle: 'bg-blue-500/10',
    bgHeavy: 'bg-blue-500/20',
    borderSubtle: 'border-blue-500/20',
    borderMedium: 'border-blue-500/30',
    borderStrong: 'border-blue-400',
    ringFocus: 'ring-blue-400/40',
    ringColor: 'ring-blue-400',
    from: 'from-blue-500',
    to: 'to-indigo-400',
    fromSubtle: 'from-blue-500/20',
    toSubtle: 'to-indigo-500/10',
    shadowGlow: 'shadow-blue-500/20',
    avatarFrom: 'from-blue-500/40',
    avatarTo: 'to-indigo-500/50',
    avatarBorder: 'border-blue-500/20',
    onlineBg: 'bg-emerald-500',
    successBg: 'bg-emerald-500/10',
    successText: 'text-emerald-400',
    successBorder: 'border-emerald-500/20',
    bgSurface: 'bg-[#0d1017]',
    bgSurfaceDeep: 'bg-[#0a0d12]',
  },
  pulse: {
    text: 'text-orange-400',
    textDim: 'text-orange-500',
    bgTint: 'bg-orange-500/15',
    bgSolid: 'bg-orange-500',
    bgSubtle: 'bg-orange-500/10',
    bgHeavy: 'bg-orange-500/20',
    borderSubtle: 'border-orange-500/20',
    borderMedium: 'border-orange-500/30',
    borderStrong: 'border-orange-400',
    ringFocus: 'ring-orange-400/40',
    ringColor: 'ring-orange-400',
    from: 'from-orange-500',
    to: 'to-rose-400',
    fromSubtle: 'from-orange-500/20',
    toSubtle: 'to-rose-500/10',
    shadowGlow: 'shadow-orange-500/20',
    avatarFrom: 'from-orange-500/40',
    avatarTo: 'to-rose-500/50',
    avatarBorder: 'border-orange-500/20',
    onlineBg: 'bg-emerald-500',
    successBg: 'bg-emerald-500/10',
    successText: 'text-emerald-400',
    successBorder: 'border-emerald-500/20',
    bgSurface: 'bg-[#100e0d]',
    bgSurfaceDeep: 'bg-[#0c0a09]',
  },
  nexus: {
    text: 'text-amber-400',
    textDim: 'text-amber-500',
    bgTint: 'bg-amber-500/15',
    bgSolid: 'bg-amber-500',
    bgSubtle: 'bg-amber-500/10',
    bgHeavy: 'bg-amber-500/20',
    borderSubtle: 'border-amber-500/20',
    borderMedium: 'border-amber-500/30',
    borderStrong: 'border-amber-400',
    ringFocus: 'ring-amber-400/40',
    ringColor: 'ring-amber-400',
    from: 'from-amber-500',
    to: 'to-yellow-400',
    fromSubtle: 'from-amber-500/20',
    toSubtle: 'to-yellow-500/10',
    shadowGlow: 'shadow-amber-500/20',
    avatarFrom: 'from-amber-500/40',
    avatarTo: 'to-yellow-500/50',
    avatarBorder: 'border-amber-500/20',
    onlineBg: 'bg-emerald-400',
    successBg: 'bg-emerald-500/10',
    successText: 'text-emerald-400',
    successBorder: 'border-emerald-500/20',
    bgSurface: 'bg-[#110e0c]',
    bgSurfaceDeep: 'bg-[#0d0b09]',
  },
}

export function useVariantAccent(): VariantAccentClasses {
  const { variant } = useUIVariant()
  return VARIANT_ACCENTS[variant]
}

export function getVariantAccent(variant: UIVariant): VariantAccentClasses {
  return VARIANT_ACCENTS[variant]
}

export function useVariantCombo() {
  const accent = useVariantAccent()
  
  return {
    accent,
    activeItem: `${accent.bgSubtle} ${accent.text}`,
    icon: accent.text,
    badge: `${accent.bgSubtle} ${accent.text} ${accent.borderSubtle}`,
    avatarBordered: accent.avatarBorder,
    avatarFallback: `bg-gradient-to-br ${accent.avatarFrom} ${accent.avatarTo}`,
    selectedButton: `${accent.bgHeavy} ${accent.text} ${accent.borderMedium}`,
    gradientText: `bg-gradient-to-r ${accent.from} ${accent.to} bg-clip-text text-transparent`,
    surface: accent.bgSurface,
    surfaceDeep: accent.bgSurfaceDeep,
    glow: `shadow-[0_0_20px_hsl(var(--primary)/0.1)]`,
  }
}
