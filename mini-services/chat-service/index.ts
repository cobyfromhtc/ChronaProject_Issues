import { createServer } from 'http'
import { Server, Socket } from 'socket.io'

// ===========================================
// Environment Configuration
// ===========================================

const PORT = 3003
const NODE_ENV = process.env.NODE_ENV || 'development'
const isProduction = NODE_ENV === 'production'

// Parse allowed CORS origins from environment
const parseCorsOrigins = (): string[] => {
  const originsEnv = process.env.CHAT_CORS_ORIGINS || process.env.CORS_ORIGINS || ''
  
  if (!originsEnv) {
    if (isProduction) {
      console.error('[CORS] WARNING: No CORS origins specified in production!')
      console.error('[CORS] Set CHAT_CORS_ORIGINS or CORS_ORIGINS environment variable')
      return [] // Block all in production if not configured
    }
    // Development default
    return ['http://localhost:3000', 'http://127.0.0.1:3000']
  }
  
  return originsEnv.split(',').map(o => o.trim()).filter(Boolean)
}

const allowedOrigins = parseCorsOrigins()

console.log('='.repeat(50))
console.log('Chrona Chat Service')
console.log('='.repeat(50))
console.log(`Environment: ${NODE_ENV}`)
console.log(`Port: ${PORT}`)
console.log(`Allowed CORS Origins: ${allowedOrigins.join(', ') || 'None (blocked)'}`)
console.log('='.repeat(50))

// ===========================================
// HTTP Server & Socket.io Setup
// ===========================================

const httpServer = createServer()
const io = new Server(httpServer, {
  // Default path is /socket.io - this is required for socket.io protocol
  path: '/socket.io',
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) {
        if (isProduction) {
          // In production, reject requests without origin
          callback(new Error('Origin header required'))
          return
        }
        // Allow in development
        callback(null, true)
        return
      }
      
      // Check if origin is allowed
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        console.warn(`[CORS] Rejected connection from origin: ${origin}`)
        callback(new Error('Not allowed by CORS'))
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e8, // 100MB for large messages/images
})

// ===========================================
// Connection Management
// ===========================================

// Store connected users with their persona info
interface ConnectedUser {
  socketId: string
  userId: string
  activePersonaId: string | null
  activePersonaName: string | null
}

const connectedUsers = new Map<string, ConnectedUser>()

// Track users by userId for quick lookup
const userSockets = new Map<string, Set<string>>()

io.on('connection', (socket: Socket) => {
  console.log(`[${new Date().toISOString()}] User connected: ${socket.id}`)
  console.log(`Current connections: ${connectedUsers.size + 1}`)

  // User identifies themselves
  socket.on('identify', (data: { userId: string; personaId?: string; personaName?: string }) => {
    const { userId, personaId, personaName } = data
    
    const userInfo: ConnectedUser = {
      socketId: socket.id,
      userId,
      activePersonaId: personaId || null,
      activePersonaName: personaName || null
    }
    connectedUsers.set(socket.id, userInfo)
    
    // Track all sockets for this user
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set())
    }
    userSockets.get(userId)!.add(socket.id)
    
    socket.emit('identified', { success: true, socketId: socket.id })
    console.log(`[${new Date().toISOString()}] User ${userId} identified with persona "${personaName || 'none'}"`)
    console.log(`Total users online: ${userSockets.size}`)
  })

  // Join a DM conversation room
  socket.on('join-conversation', (data: { conversationId: string }) => {
    socket.join(`conversation:${data.conversationId}`)
    socket.emit('joined-conversation', { conversationId: data.conversationId })
    console.log(`[${new Date().toISOString()}] Socket ${socket.id} joined DM conversation ${data.conversationId}`)
  })

  // Leave a DM conversation room
  socket.on('leave-conversation', (data: { conversationId: string }) => {
    socket.leave(`conversation:${data.conversationId}`)
    console.log(`[${new Date().toISOString()}] Socket ${socket.id} left DM conversation ${data.conversationId}`)
  })

  // Join a storyline channel room
  socket.on('join-channel', (data: { channelId: string }) => {
    socket.join(`channel:${data.channelId}`)
    socket.emit('joined-channel', { channelId: data.channelId })
    console.log(`[${new Date().toISOString()}] Socket ${socket.id} joined channel ${data.channelId}`)
  })

  // Leave a storyline channel room
  socket.on('leave-channel', (data: { channelId: string }) => {
    socket.leave(`channel:${data.channelId}`)
    console.log(`[${new Date().toISOString()}] Socket ${socket.id} left channel ${data.channelId}`)
  })

  // Broadcast new message to DM conversation
  socket.on('message-sent', (data: { 
    conversationId: string
    message: {
      id: string
      conversationId: string
      senderId: string
      sender: { id: string; name: string; avatarUrl: string | null }
      content: string
      imageUrl: string | null
      createdAt: string
    }
  }) => {
    const { conversationId, message } = data
    // Broadcast to all other users in the conversation
    socket.to(`conversation:${conversationId}`).emit('new-message', message)
    console.log(`[${new Date().toISOString()}] Message broadcast to DM conversation ${conversationId}`)
  })

  // Broadcast new message to storyline channel
  socket.on('channel-message-sent', (data: { 
    channelId: string
    message: {
      id: string
      channelId: string
      senderId: string
      sender: { id: string; name: string; avatarUrl: string | null }
      content: string
      imageUrl: string | null
      createdAt: string
    }
  }) => {
    const { channelId, message } = data
    // Broadcast to all users in the channel
    socket.to(`channel:${channelId}`).emit('new-channel-message', message)
    console.log(`[${new Date().toISOString()}] Message broadcast to channel ${channelId}`)
  })

  // Typing indicator for DMs
  socket.on('typing', (data: { conversationId: string; isTyping: boolean; personaName: string }) => {
    const { conversationId, isTyping, personaName } = data
    socket.to(`conversation:${conversationId}`).emit('user-typing', {
      conversationId,
      isTyping,
      personaName,
    })
  })

  // Typing indicator for channels
  socket.on('channel-typing', (data: { channelId: string; isTyping: boolean; personaName: string }) => {
    const { channelId, isTyping, personaName } = data
    socket.to(`channel:${channelId}`).emit('user-channel-typing', {
      channelId,
      isTyping,
      personaName,
    })
  })

  // Update active persona
  socket.on('update-persona', (data: { userId: string; personaId: string; personaName: string }) => {
    const userInfo = connectedUsers.get(socket.id)
    if (userInfo && userInfo.userId === data.userId) {
      userInfo.activePersonaId = data.personaId
      userInfo.activePersonaName = data.personaName
      console.log(`[${new Date().toISOString()}] User ${data.userId} switched to persona "${data.personaName}"`)
    }
  })

  // Get online users count
  socket.on('get-online-count', () => {
    socket.emit('online-count', { 
      count: userSockets.size,
      sockets: connectedUsers.size 
    })
  })

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    const userInfo = connectedUsers.get(socket.id)
    if (userInfo) {
      // Remove from userSockets map
      const userSocketSet = userSockets.get(userInfo.userId)
      if (userSocketSet) {
        userSocketSet.delete(socket.id)
        if (userSocketSet.size === 0) {
          userSockets.delete(userInfo.userId)
        }
      }
      connectedUsers.delete(socket.id)
      console.log(`[${new Date().toISOString()}] User disconnected: ${userInfo.userId} (reason: ${reason})`)
      console.log(`Total users online: ${userSockets.size}, Total sockets: ${connectedUsers.size}`)
    } else {
      console.log(`[${new Date().toISOString()}] Unknown socket disconnected: ${socket.id} (reason: ${reason})`)
    }
  })

  // Error handling
  socket.on('error', (error) => {
    console.error(`[${new Date().toISOString()}] Socket error (${socket.id}):`, error)
  })
})

// ===========================================
// Server Startup
// ===========================================

// Start the server
httpServer.listen(PORT, () => {
  console.log(`Chat WebSocket server running on port ${PORT}`)
  console.log(`Ready to accept connections!`)
})

// ===========================================
// Graceful Shutdown
// ===========================================

const gracefulShutdown = (signal: string) => {
  console.log(`\n[${new Date().toISOString()}] Received ${signal}, shutting down server...`)
  
  // Notify all connected clients
  io.emit('server-shutdown', { message: 'Server is shutting down' })
  
  // Close all connections
  io.close(() => {
    console.log('All connections closed')
    httpServer.close(() => {
      console.log('HTTP server closed')
      process.exit(0)
    })
  })
  
  // Force exit after 10 seconds
  setTimeout(() => {
    console.log('Forcing exit...')
    process.exit(1)
  }, 10000)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})
