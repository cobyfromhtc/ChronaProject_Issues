'use client'

import { useEffect, useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'

interface LoadingScreenProps {
  onFinished: () => void
}

// Deterministic seeded pseudo-random number generator
// Uses a simple mulberry32 algorithm so server & client produce identical values
function seededRandom(seed: number): () => number {
  let state = seed | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function LoadingScreen({ onFinished }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0)
  const [fadeOut, setFadeOut] = useState(false)

  // Generate particle styles deterministically so SSR & client match
  const particles = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => {
      const rng = seededRandom(i * 1337 + 42)
      return {
        width: `${rng() * 4 + 2}px`,
        height: `${rng() * 4 + 2}px`,
        left: `${rng() * 100}%`,
        top: `${rng() * 100}%`,
        background: `hsl(${180 + rng() * 40}, 80%, ${55 + rng() * 20}%)`,
        opacity: 0.3 + rng() * 0.4,
        animation: `float-particle ${3 + rng() * 4}s ease-in-out ${rng() * 2}s infinite`,
      }
    })
  }, [])

  useEffect(() => {
    // Animate progress bar
    const duration = 2000 // 2 seconds total
    const interval = 20
    const steps = duration / interval
    let current = 0

    const timer = setInterval(() => {
      current++
      // Eased progress - fast at start, slower at end
      const t = current / steps
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      setProgress(Math.min(eased * 100, 100))

      if (current >= steps) {
        clearInterval(timer)
        // Start fade out
        setTimeout(() => {
          setFadeOut(true)
          setTimeout(onFinished, 500)
        }, 200)
      }
    }, interval)

    return () => clearInterval(timer)
  }, [onFinished])

  return (
    <div
      className={`fixed inset-0 z-[100] persona-bg flex items-center justify-center transition-opacity duration-500 ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Animated background */}
      <div className="absolute inset-0 persona-gradient-animated opacity-70" />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden">
        {particles.map((style, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={style}
          />
        ))}
      </div>

      {/* Glow orbs */}
      <div className="absolute inset-0">
        <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-cyan-500/8 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: '1s' }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative flex flex-col items-center gap-6 z-10">
        {/* Logo with pulse/glow */}
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl bg-teal-500/20 blur-xl animate-pulse scale-150" />
          <img
            src="/logo.png"
            alt="Chrona"
            className="w-20 h-20 rounded-2xl shadow-lg shadow-teal-500/30 object-cover relative z-10"
            style={{
              animation: 'pulse-glow 2s ease-in-out infinite',
            }}
          />
          <Sparkles className="absolute -top-2 -right-2 w-5 h-5 text-cyan-400 animate-pulse z-20" />
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-4xl font-bold persona-gradient-text">Chrona</h1>
          <p className="text-slate-400 text-sm mt-2 tracking-wider uppercase">
            Roleplay Universe
          </p>
        </div>

        {/* Loading bar */}
        <div className="w-48 mt-4">
          <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-100 ease-out"
              style={{
                width: `${progress}%`,
                background:
                  'linear-gradient(90deg, hsl(200 80% 55%), hsl(190 70% 45%), hsl(170 70% 45%))',
                boxShadow: '0 0 10px hsl(200 80% 55% / 0.5)',
              }}
            />
          </div>
          <p className="text-xs text-slate-500 text-center mt-2">
            Loading...
          </p>
        </div>
      </div>
    </div>
  )
}
