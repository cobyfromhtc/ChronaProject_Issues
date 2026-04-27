'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/stores/auth-store'
import { usePersonaStore } from '@/stores/persona-store'

export interface ChatMessage {
  id: string
  conversationId: string
  senderId: string
  sender: {
    id: string
    name: string
    avatarUrl: string | null
    isOfficial?: boolean
  }
  content: string
  imageUrl: string | null
  createdAt: string
}

export interface ChannelMessage {
  id: string
  channelId: string
  senderId: string
  sender: {
    id: string
    name: string
    avatarUrl: string | null
    isOfficial?: boolean
  }
  content: string
  imageUrl: string | null
  createdAt: string
}

interface UseChatOptions {
  conversationId: string | null
  onNewMessage?: (message: ChatMessage) => void
  onTyping?: (data: { isTyping: boolean; personaName: string }) => void
}

interface UseChannelChatOptions {
  channelId: string | null
  onNewMessage?: (message: ChannelMessage) => void
  onTyping?: (data: { channelId: string; isTyping: boolean; personaName: string }) => void
}

// ── Connection Status Tracking ────────────────────────────────────────────────
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed'

type StatusListener = (status: ConnectionStatus) => void

const statusListeners = new Set<StatusListener>()
let currentStatus: ConnectionStatus = 'disconnected'

function setConnectionStatus(status: ConnectionStatus) {
  if (currentStatus === status) return
  currentStatus = status
  statusListeners.forEach((listener) => listener(status))
}

export function getConnectionStatus(): ConnectionStatus {
  return currentStatus
}

export function onConnectionStatusChange(listener: StatusListener): () => void {
  statusListeners.add(listener)
  // Immediately call with current status
  listener(currentStatus)
  return () => {
    statusListeners.delete(listener)
  }
}

// ── Socket URL ────────────────────────────────────────────────────────────────
function getSocketUrl(): string {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL
  }
  // In development, use the gateway with XTransformPort
  return ''
}

// ── Singleton Socket Instance ─────────────────────────────────────────────────
let socketInstance: Socket | null = null
let socketUsers = 0
let healthCheckInterval: ReturnType<typeof setInterval> | null = null
let isReconnectingManually = false

function startHealthCheck() {
  if (healthCheckInterval) return

  // Poll every 10s to detect if the chat service has come online
  healthCheckInterval = setInterval(() => {
    if (socketInstance && !socketInstance.connected && currentStatus === 'failed') {
      console.log('[Socket] Health check: chat service may be back online, attempting reconnect...')
      isReconnectingManually = true
      socketInstance.connect()
    }
  }, 10000)
}

function stopHealthCheck() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval)
    healthCheckInterval = null
  }
}

function getSocket(): Socket | null {
  if (!socketInstance) {
    const socketUrl = getSocketUrl()

    // For gateway routing, we need to pass XTransformPort in query
    socketInstance = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 500,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5,
      timeout: 30000,
      forceNew: false,
      query: { XTransformPort: '3003' },
    })

    setConnectionStatus('connecting')

    socketInstance.on('connect', () => {
      console.log('[Socket] Connected:', socketInstance?.id)
      setConnectionStatus('connected')
      isReconnectingManually = false
    })

    socketInstance.on('disconnect', (reason: Socket.DisconnectReason) => {
      console.log('[Socket] Disconnected:', reason)
      // Only set to disconnected if it's a clean disconnect (not the server
      // dropping us — socket.io will auto-reconnect in that case)
      if (reason === 'io client disconnect') {
        setConnectionStatus('disconnected')
        stopHealthCheck()
      } else {
        setConnectionStatus('reconnecting')
      }
    })

    socketInstance.on('connect_error', (error: Error) => {
      const isTimeout = error.message === 'timeout'

      if (isTimeout) {
        console.warn(
          '[Socket] Connection timeout — the chat service may not be running yet. ' +
          'Will retry automatically.'
        )
      } else {
        console.warn('[Socket] Connection error:', error.message)
      }

      // If socket.io has exhausted its reconnection attempts, mark as failed
      // and start our own health-check loop so we reconnect when the service
      // comes back online.
      if (
        socketInstance &&
        !socketInstance.connected &&
        !socketInstance.active
      ) {
        setConnectionStatus('failed')
        startHealthCheck()
      } else if (currentStatus !== 'failed') {
        setConnectionStatus('reconnecting')
      }
    })

    socketInstance.on('reconnect', (attemptNumber: number) => {
      console.log('[Socket] Reconnected after', attemptNumber, 'attempts')
      setConnectionStatus('connected')
      isReconnectingManually = false
    })

    socketInstance.on('reconnect_failed', () => {
      console.warn('[Socket] All reconnection attempts exhausted. Starting health check...')
      setConnectionStatus('failed')
      startHealthCheck()
    })

    socketInstance.on('reconnect_attempt', (attempt: number) => {
      console.log('[Socket] Reconnection attempt', attempt)
      setConnectionStatus('reconnecting')
    })

    // Start the health check right away in case the chat service isn't running yet
    startHealthCheck()
  }
  return socketInstance
}

function releaseSocket() {
  socketUsers--
  if (socketUsers <= 0 && socketInstance) {
    stopHealthCheck()
    socketInstance.disconnect()
    socketInstance = null
    socketUsers = 0
    setConnectionStatus('disconnected')
  }
}

// ── Manual Reconnect Helper ───────────────────────────────────────────────────
export function reconnectSocket() {
  if (socketInstance) {
    console.log('[Socket] Manual reconnect triggered')
    isReconnectingManually = true
    socketInstance.disconnect().connect()
    setConnectionStatus('connecting')
  } else {
    // No instance yet — calling getSocket() will create one
    getSocket()
  }
}

// ── useConnectionStatus Hook ──────────────────────────────────────────────────
export function useConnectionStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>(currentStatus)

  useEffect(() => {
    return onConnectionStatusChange(setStatus)
  }, [])

  return status
}

// Hook for DM conversations
export function useChat({ conversationId, onNewMessage, onTyping }: UseChatOptions) {
  const [isConnected, setIsConnected] = useState(false)
  const [isIdentified, setIsIdentified] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const { user } = useAuthStore()
  const { activePersona } = usePersonaStore()

  // Connect to socket
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    socketUsers++
    socketRef.current = socket

    const handleConnect = () => {
      setIsConnected(true)
      console.log('[Chat] Socket connected')

      // Identify ourselves
      if (user && activePersona) {
        socket.emit('identify', {
          userId: user.id,
          personaId: activePersona.id,
          personaName: activePersona.name
        })
      } else if (user) {
        socket.emit('identify', { userId: user.id })
      }
    }

    const handleDisconnect = () => {
      setIsConnected(false)
      setIsIdentified(false)
      console.log('[Chat] Socket disconnected')
    }

    const handleIdentified = () => {
      setIsIdentified(true)
      console.log('[Chat] Socket identified')
    }

    const handleNewMessage = (message: ChatMessage) => {
      console.log('[Chat] New message received:', message)
      onNewMessage?.(message)
    }

    const handleTyping = (data: { conversationId: string; isTyping: boolean; personaName: string }) => {
      onTyping?.(data)
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('identified', handleIdentified)
    socket.on('new-message', handleNewMessage)
    socket.on('user-typing', handleTyping)

    // If already connected, trigger connect handler
    if (socket.connected) {
      handleConnect()
    }

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('identified', handleIdentified)
      socket.off('new-message', handleNewMessage)
      socket.off('user-typing', handleTyping)
      releaseSocket()
    }
  }, [user?.id])

  // Join/leave conversation
  useEffect(() => {
    const socket = socketRef.current
    if (!socket || !isConnected || !conversationId) return

    // Join the conversation room
    socket.emit('join-conversation', { conversationId })
    console.log('[Chat] Joined conversation:', conversationId)

    return () => {
      socket.emit('leave-conversation', { conversationId })
      console.log('[Chat] Left conversation:', conversationId)
    }
  }, [isConnected, conversationId])

  // Update identity when activePersona changes
  useEffect(() => {
    const socket = socketRef.current
    if (socket && isConnected && user && activePersona) {
      socket.emit('update-persona', {
        userId: user.id,
        personaId: activePersona.id,
        personaName: activePersona.name
      })
    }
  }, [isConnected, activePersona?.id, user?.id])

  // Broadcast message to conversation
  const broadcastMessage = useCallback((message: ChatMessage) => {
    const socket = socketRef.current
    if (socket && isConnected) {
      socket.emit('message-sent', {
        conversationId: message.conversationId,
        message
      })
      console.log('[Chat] Message broadcast:', message.id)
    }
  }, [isConnected])

  // Typing indicator
  const sendTyping = useCallback((isTyping: boolean) => {
    const socket = socketRef.current
    if (socket && isConnected && activePersona && conversationId) {
      // Clear any existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      socket.emit('typing', {
        conversationId,
        isTyping,
        personaName: activePersona.name
      })

      // Auto-stop typing after 3 seconds
      if (isTyping) {
        typingTimeoutRef.current = setTimeout(() => {
          socket.emit('typing', {
            conversationId,
            isTyping: false,
            personaName: activePersona.name
          })
        }, 3000)
      }
    }
  }, [isConnected, activePersona, conversationId])

  return {
    isConnected,
    isIdentified,
    broadcastMessage,
    sendTyping,
  }
}

// Hook for storyline channels
export function useChannelChat({ channelId, onNewMessage, onTyping }: UseChannelChatOptions) {
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const { user } = useAuthStore()
  const { activePersona } = usePersonaStore()

  // Connect to socket
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    socketUsers++
    socketRef.current = socket

    const handleConnect = () => {
      setIsConnected(true)

      if (user && activePersona) {
        socket.emit('identify', {
          userId: user.id,
          personaId: activePersona.id,
          personaName: activePersona.name
        })
      } else if (user) {
        socket.emit('identify', { userId: user.id })
      }
    }

    const handleDisconnect = () => {
      setIsConnected(false)
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)

    if (socket.connected) {
      handleConnect()
    }

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      releaseSocket()
    }
  }, [user?.id])

  // Join/leave channel
  useEffect(() => {
    const socket = socketRef.current
    if (!socket || !isConnected || !channelId) return

    socket.emit('join-channel', { channelId })
    console.log('[Channel] Joined channel:', channelId)

    return () => {
      socket.emit('leave-channel', { channelId })
      console.log('[Channel] Left channel:', channelId)
    }
  }, [isConnected, channelId])

  // Listen for new channel messages
  useEffect(() => {
    const socket = socketRef.current
    if (!socket || !channelId) return

    const handleNewMessage = (message: ChannelMessage) => {
      console.log('[Channel] New message received:', message)
      onNewMessage?.(message)
    }

    const handleTyping = (data: { channelId: string; isTyping: boolean; personaName: string }) => {
      onTyping?.(data)
    }

    socket.on('new-channel-message', handleNewMessage)
    socket.on('user-channel-typing', handleTyping)

    return () => {
      socket.off('new-channel-message', handleNewMessage)
      socket.off('user-channel-typing', handleTyping)
    }
  }, [channelId, onNewMessage, onTyping])

  // Broadcast message to channel
  const broadcastMessage = useCallback((message: ChannelMessage) => {
    const socket = socketRef.current
    if (socket && isConnected) {
      socket.emit('channel-message-sent', {
        channelId: message.channelId,
        message
      })
    }
  }, [isConnected])

  // Typing indicator
  const sendTyping = useCallback((isTyping: boolean) => {
    const socket = socketRef.current
    if (socket && isConnected && activePersona && channelId) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      socket.emit('channel-typing', {
        channelId,
        isTyping,
        personaName: activePersona.name
      })

      if (isTyping) {
        typingTimeoutRef.current = setTimeout(() => {
          socket.emit('channel-typing', {
            channelId,
            isTyping: false,
            personaName: activePersona.name
          })
        }, 3000)
      }
    }
  }, [isConnected, activePersona, channelId])

  return {
    isConnected,
    broadcastMessage,
    sendTyping,
  }
}

// Utility to get online users count (admin use)
export function useOnlineCount() {
  const [count, setCount] = useState(0)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    socketRef.current = socket

    const handleCount = (data: { count: number; sockets: number }) => {
      setCount(data.count)
    }

    socket.on('online-count', handleCount)

    // Request count periodically
    const interval = setInterval(() => {
      socket.emit('get-online-count')
    }, 30000)

    // Initial request
    if (socket.connected) {
      socket.emit('get-online-count')
    }

    return () => {
      clearInterval(interval)
      socket.off('online-count', handleCount)
    }
  }, [])

  return count
}
