'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from './auth-store'
import { apiFetch, apiJson } from '@/lib/api-client'

export interface ChronosData {
  chronos: number
  hasFirstPurchaseBonus: boolean
  nameColor: string | null
  dailyImagesUsed: number
  dailyImagesLimit: number
  lastDailyClaimAt: string | null
  slots: {
    free: number
    purchased: number
    total: number
    used: number
    available: number
  }
  transactions: ChronosTransaction[]
  ownedThemes: string[]
}

export interface ChronosTransaction {
  id: string
  amount: number
  balance: number
  type: string
  category: string
  description: string
  referenceId: string | null
  createdAt: string
}

// Pricing constants
export const CHRONOS_PRICING = {
  PERSONA_SLOT: 200,
  STORYLINE: 500,
  EXTRA_IMAGE: 2,
  NAME_COLOR: 300,
  DAILY_LOGIN: 10,
  DAILY_BONUS: 50,
  WEEKLY_STREAK: 50,
  MAX_GIFT_AMOUNT: 1000,
  MAX_PURCHASE_AMOUNT: 1000,
} as const

// Chronos pack prices (real money -> Chronos)
// Maximum 1000 Chronos per purchase
export const CHRONOS_PACKS = [
  { id: 'starter', chronos: 200, price: '$1.99', bonus: 0, popular: false, recommended: false },
  { id: 'standard', chronos: 500, price: '$4.99', bonus: 50, popular: true, recommended: true },
  { id: 'value', chronos: 850, price: '$9.99', bonus: 150, popular: true, recommended: false },
] as const

interface ChronosState {
  data: ChronosData | null
  isLoading: boolean
  error: string | null
}

export function useChronos() {
  const { user } = useAuthStore()
  const [state, setState] = useState<ChronosState>({
    data: null,
    isLoading: false,
    error: null
  })

  // Fetch Chronos data
  const fetchData = useCallback(async () => {
    if (!user) {
      setState({ data: null, isLoading: false, error: null })
      return
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const data = await apiJson<ChronosData>('/api/chronos')
      setState({ data, isLoading: false, error: null })
    } catch (error) {
      console.error('Error fetching Chronos:', error)
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch Chronos' 
      }))
    }
  }, [user])

  // Fetch on mount and when user changes
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Purchase a persona slot
  const purchaseSlot = useCallback(async () => {
    try {
      const result = await apiJson<{ success?: boolean; error?: string; bonusReceived?: boolean; isFirstPurchase?: boolean; message?: string }>('/api/chronos/purchase', {
        method: 'POST',
        body: JSON.stringify({ action: 'buy_slot' }),
      })

      if (result.error) {
        return { success: false, error: result.error }
      }

      await fetchData()

      return { 
        success: true, 
        bonusReceived: result.bonusReceived,
        isFirstPurchase: result.isFirstPurchase,
        message: result.message
      }
    } catch (error) {
      return { success: false, error: 'Failed to purchase slot' }
    }
  }, [fetchData])

  // Purchase name color
  const purchaseNameColor = useCallback(async (color: string) => {
    try {
      const result = await apiJson<{ success?: boolean; error?: string; bonusReceived?: boolean; isFirstPurchase?: boolean; message?: string }>('/api/chronos/purchase', {
        method: 'POST',
        body: JSON.stringify({ action: 'buy_name_color', data: { color } }),
      })

      if (result.error) {
        return { success: false, error: result.error }
      }

      await fetchData()

      return { 
        success: true,
        bonusReceived: result.bonusReceived,
        isFirstPurchase: result.isFirstPurchase,
        message: result.message
      }
    } catch (error) {
      return { success: false, error: 'Failed to purchase name color' }
    }
  }, [fetchData])

  // Purchase profile theme
  const purchaseTheme = useCallback(async (themeId: string) => {
    try {
      const result = await apiJson<{ success?: boolean; error?: string; bonusReceived?: boolean; isFirstPurchase?: boolean; message?: string }>('/api/chronos/purchase', {
        method: 'POST',
        body: JSON.stringify({ action: 'buy_theme', data: { themeId } }),
      })

      if (result.error) {
        return { success: false, error: result.error }
      }

      await fetchData()

      return { 
        success: true,
        bonusReceived: result.bonusReceived,
        isFirstPurchase: result.isFirstPurchase,
        message: result.message
      }
    } catch (error) {
      return { success: false, error: 'Failed to purchase theme' }
    }
  }, [fetchData])

  // Spend for extra image
  const spendForExtraImage = useCallback(async () => {
    try {
      const result = await apiJson<{ success?: boolean; error?: string }>('/api/chronos/purchase', {
        method: 'POST',
        body: JSON.stringify({ action: 'extra_image' }),
      })

      if (result.error) {
        return { success: false, error: result.error }
      }

      await fetchData()

      return { success: true }
    } catch (error) {
      return { success: false, error: 'Failed to send extra image' }
    }
  }, [fetchData])

  // Spend for storyline creation
  const spendForStoryline = useCallback(async () => {
    try {
      const result = await apiJson<{ success?: boolean; error?: string; bonusReceived?: boolean; isFirstPurchase?: boolean; message?: string }>('/api/chronos/purchase', {
        method: 'POST',
        body: JSON.stringify({ action: 'create_storyline' }),
      })

      if (result.error) {
        return { success: false, error: result.error }
      }

      await fetchData()

      return { 
        success: true,
        bonusReceived: result.bonusReceived,
        isFirstPurchase: result.isFirstPurchase,
        message: result.message
      }
    } catch (error) {
      return { success: false, error: 'Failed to create storyline' }
    }
  }, [fetchData])

  // Claim daily bonus (50 Chronos)
  const claimDailyBonus = useCallback(async () => {
    try {
      const result = await apiJson<{ success?: boolean; error?: string; amount?: number; canClaim?: boolean; nextClaimIn?: string }>('/api/chronos/daily', {
        method: 'POST',
      })

      if (result.error) {
        return { success: false, error: result.error, canClaim: result.canClaim, nextClaimIn: result.nextClaimIn }
      }

      await fetchData()

      return { success: true, amount: result.amount, canClaim: result.canClaim, nextClaimIn: result.nextClaimIn }
    } catch (error) {
      return { success: false, error: 'Failed to claim daily bonus' }
    }
  }, [fetchData])

  // Check daily bonus status
  const checkDailyBonus = useCallback(async () => {
    try {
      const result = await apiJson<{ canClaim?: boolean; nextClaimIn?: string; amount?: number }>('/api/chronos/daily').catch(() => ({ canClaim: false, nextClaimIn: '', amount: 0 }))
      if (!result.canClaim) {
        return { canClaim: false, nextClaimIn: '', amount: 0 }
      }
      return { canClaim: result.canClaim, nextClaimIn: result.nextClaimIn, amount: result.amount }
    } catch (error) {
      return { canClaim: false, nextClaimIn: '', amount: 0 }
    }
  }, [])

  // Claim daily login bonus
  const claimDailyLogin = useCallback(async () => {
    try {
      const result = await apiJson<{ success?: boolean; error?: string }>('/api/chronos/purchase', {
        method: 'POST',
        body: JSON.stringify({ action: 'earn_daily' }),
      })

      if (result.error) {
        return { success: false, error: result.error }
      }

      await fetchData()

      return { success: true }
    } catch (error) {
      return { success: false, error: 'Failed to claim daily bonus' }
    }
  }, [fetchData])

  // Claim weekly streak bonus
  const claimStreakBonus = useCallback(async () => {
    try {
      const result = await apiJson<{ success?: boolean; error?: string }>('/api/chronos/purchase', {
        method: 'POST',
        body: JSON.stringify({ action: 'earn_streak' }),
      })

      if (result.error) {
        return { success: false, error: result.error }
      }

      await fetchData()

      return { success: true }
    } catch (error) {
      return { success: false, error: 'Failed to claim streak bonus' }
    }
  }, [fetchData])

  // Gift Chronos to another user
  const giftChronos = useCallback(async (recipientUsername: string, amount: number, message?: string) => {
    try {
      const result = await apiJson<{ success?: boolean; error?: string; recipientUsername?: string; amount?: number; message?: string }>('/api/chronos/gift', {
        method: 'POST',
        body: JSON.stringify({ recipientUsername, amount, message }),
      })

      if (result.error) {
        return { success: false, error: result.error }
      }

      await fetchData()

      return { 
        success: true, 
        recipientUsername: result.recipientUsername,
        amount: result.amount,
        message: result.message
      }
    } catch (error) {
      return { success: false, error: 'Failed to send gift' }
    }
  }, [fetchData])

  return {
    ...state,
    refresh: fetchData,
    purchaseSlot,
    purchaseNameColor,
    purchaseTheme,
    spendForExtraImage,
    spendForStoryline,
    claimDailyBonus,
    checkDailyBonus,
    claimDailyLogin,
    claimStreakBonus,
    giftChronos,
  }
}
