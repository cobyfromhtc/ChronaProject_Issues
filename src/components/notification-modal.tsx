'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { 
  Bell, X, Coins, AlertTriangle, Check, ChevronRight,
  Loader2
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  data: string | null
  createdAt: string
}

export function NotificationModal() {
  const { user, isAuthenticated } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  // Fetch notifications when user logs in
  useEffect(() => {
    if (!isAuthenticated || !user) return

    const fetchNotifications = async () => {
      setIsLoading(true)
      try {
        const response = await fetch('/api/notifications')
        if (response.ok) {
          const data = await response.json()
          if (data.notifications && data.notifications.length > 0) {
            setNotifications(data.notifications)
            setCurrentIndex(0)
            setIsOpen(true)
          }
        }
      } catch (error) {
        console.error('Error fetching notifications:', error)
      } finally {
        setIsLoading(false)
      }
    }

    // Small delay to ensure auth state is settled
    const timer = setTimeout(fetchNotifications, 500)
    return () => clearTimeout(timer)
  }, [isAuthenticated, user?.id])

  const dismissNotification = async (notificationId: string) => {
    try {
      await fetch('/api/notifications/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId })
      })
    } catch (error) {
      console.error('Error dismissing notification:', error)
    }
  }

  const handleNext = async () => {
    const currentNotification = notifications[currentIndex]
    if (currentNotification) {
      await dismissNotification(currentNotification.id)
    }

    if (currentIndex < notifications.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      setIsOpen(false)
      setIsDismissed(true)
    }
  }

  const handleDismissAll = async () => {
    try {
      await fetch('/api/notifications/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismissAll: true })
      })
    } catch (error) {
      console.error('Error dismissing all notifications:', error)
    }
    setIsOpen(false)
    setIsDismissed(true)
  }

  // Don't render anything if not authenticated, loading, or already dismissed
  if (!isAuthenticated || isLoading || isDismissed || !isOpen || notifications.length === 0) {
    return null
  }

  const currentNotification = notifications[currentIndex]
  if (!currentNotification) return null

  // Get icon based on notification type
  const getIcon = () => {
    switch (currentNotification.type) {
      case 'chronos_reset':
        return <AlertTriangle className="w-6 h-6 text-red-400" />
      case 'chronos_grant':
        return <Coins className="w-6 h-6 text-emerald-400" />
      case 'chronos_deduct':
        return <Coins className="w-6 h-6 text-amber-400" />
      default:
        return <Bell className="w-6 h-6 text-slate-400" />
    }
  }

  // Get background gradient based on type
  const getBackground = () => {
    switch (currentNotification.type) {
      case 'chronos_reset':
        return 'from-red-900/30 to-red-950/30 border-red-500/30'
      case 'chronos_grant':
        return 'from-emerald-900/30 to-emerald-950/30 border-emerald-500/30'
      case 'chronos_deduct':
        return 'from-amber-900/30 to-amber-950/30 border-amber-500/30'
      default:
        return 'from-slate-900/20 to-purple-950/30 border-teal-500/20'
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className={`w-full max-w-md rounded-2xl bg-gradient-to-b ${getBackground()} border shadow-2xl overflow-hidden`}>
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black/30 flex items-center justify-center">
              {getIcon()}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{currentNotification.title}</h2>
              <p className="text-xs text-white/50">
                {formatDistanceToNow(new Date(currentNotification.createdAt))} ago
              </p>
            </div>
          </div>
          <button
            onClick={handleDismissAll}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="bg-black/20 rounded-xl p-4">
            <p className="text-white/90 whitespace-pre-line leading-relaxed">
              {currentNotification.message}
            </p>
          </div>

          {/* Navigation dots */}
          {notifications.length > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              {notifications.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentIndex ? 'bg-white' : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/10 flex gap-3">
          {notifications.length > 1 && (
            <Button
              onClick={handleDismissAll}
              variant="ghost"
              className="flex-1 text-white/70 hover:text-white hover:bg-white/10"
            >
              Dismiss All
            </Button>
          )}
          <Button
            onClick={handleNext}
            className="flex-1 bg-white/20 hover:bg-white/30 text-white"
          >
            {currentIndex < notifications.length - 1 ? (
              <>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" /> Got it
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
