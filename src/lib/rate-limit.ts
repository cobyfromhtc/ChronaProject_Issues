import { NextRequest } from 'next/server'

// Simple in-memory rate limiter
// For production, consider using Redis for distributed rate limiting

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

const store: RateLimitStore = {}

interface RateLimitConfig {
  windowMs?: number // Time window in milliseconds
  maxRequests?: number // Max requests per window
  message?: string // Custom error message
}

const defaultConfig: Required<RateLimitConfig> = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  message: 'Too many requests, please try again later.'
}

function getClientIp(request: NextRequest): string {
  // Try to get real IP from headers (for proxies)
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }
  
  // Fallback for development
  return '127.0.0.1'
}

function getKey(ip: string, path: string): string {
  return `${ip}:${path}`
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetTime: number
  message?: string
}

export function checkRateLimit(request: NextRequest, config: RateLimitConfig = {}): RateLimitResult {
  const finalConfig = { ...defaultConfig, ...config }
  const ip = getClientIp(request)
  const path = request.nextUrl.pathname
  const key = getKey(ip, path)
  
  const now = Date.now()
  const record = store[key]
  
  // Clean up expired entries periodically
  if (Object.keys(store).length > 10000) {
    for (const k in store) {
      if (store[k].resetTime < now) {
        delete store[k]
      }
    }
  }
  
  if (!record || record.resetTime < now) {
    // New window
    store[key] = {
      count: 1,
      resetTime: now + finalConfig.windowMs
    }
    return {
      success: true,
      remaining: finalConfig.maxRequests - 1,
      resetTime: now + finalConfig.windowMs
    }
  }
  
  if (record.count >= finalConfig.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetTime: record.resetTime,
      message: finalConfig.message
    }
  }
  
  // Increment count
  record.count++
  return {
    success: true,
    remaining: finalConfig.maxRequests - record.count,
    resetTime: record.resetTime
  }
}

// Higher-order function to wrap API handlers with rate limiting
export function withRateLimit(
  handler: (request: NextRequest) => Promise<Response>,
  config: RateLimitConfig = {}
) {
  return async (request: NextRequest): Promise<Response> => {
    const result = checkRateLimit(request, config)
    
    if (!result.success) {
      return new Response(
        JSON.stringify({ 
          error: result.message || 'Rate limit exceeded',
          resetTime: result.resetTime 
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': result.resetTime.toString()
          }
        }
      )
    }
    
    const response = await handler(request)
    
    // Add rate limit headers to response
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
    response.headers.set('X-RateLimit-Reset', result.resetTime.toString())
    
    return response
  }
}

// Preset configurations for different endpoints
export const rateLimitPresets = {
  auth: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 50, // 50 attempts per minute (dev-friendly)
    message: 'Too many authentication attempts. Please try again later.'
  },
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    message: 'Too many requests. Please slow down.'
  },
  upload: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    message: 'Too many uploads. Please wait before uploading again.'
  },
  message: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    message: 'You are sending messages too quickly.'
  }
}

// Pre-configured rate limiters for common use cases
export function authRateLimiter(request: NextRequest): Response | null {
  const result = checkRateLimit(request, rateLimitPresets.auth)
  
  if (!result.success) {
    return new Response(
      JSON.stringify({ 
        error: result.message || 'Rate limit exceeded',
        resetTime: result.resetTime 
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.resetTime.toString()
        }
      }
    )
  }
  
  return null
}

export function apiRateLimiter(request: NextRequest): Response | null {
  const result = checkRateLimit(request, rateLimitPresets.api)
  
  if (!result.success) {
    return new Response(
      JSON.stringify({ 
        error: result.message || 'Rate limit exceeded',
        resetTime: result.resetTime 
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.resetTime.toString()
        }
      }
    )
  }
  
  return null
}

export function uploadRateLimiter(request: NextRequest): Response | null {
  const result = checkRateLimit(request, rateLimitPresets.upload)
  
  if (!result.success) {
    return new Response(
      JSON.stringify({ 
        error: result.message || 'Rate limit exceeded',
        resetTime: result.resetTime 
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.resetTime.toString()
        }
      }
    )
  }
  
  return null
}

export function messageRateLimiter(request: NextRequest): Response | null {
  const result = checkRateLimit(request, rateLimitPresets.message)
  
  if (!result.success) {
    return new Response(
      JSON.stringify({ 
        error: result.message || 'Rate limit exceeded',
        resetTime: result.resetTime 
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.resetTime.toString()
        }
      }
    )
  }
  
  return null
}