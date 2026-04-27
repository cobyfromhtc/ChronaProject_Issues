'use client'

import React, { Component } from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  retryCount: number
}

/**
 * ErrorBoundary that catches ChunkLoadError and other runtime errors
 * from lazy-loaded components. Provides a retry mechanism for chunk
 * loading failures which can occur during development with HMR.
 */
export class ChunkErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, retryCount: 0 }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ChunkErrorBoundary] Caught error:', error)
    console.error('[ChunkErrorBoundary] Component stack:', errorInfo.componentStack)
  }

  handleRetry = () => {
    this.setState(prev => ({ hasError: false, error: null, retryCount: prev.retryCount + 1 }))
  }

  render() {
    if (this.state.hasError) {
      const isChunkError =
        this.state.error?.message?.includes('Failed to load chunk') ||
        this.state.error?.message?.includes('ChunkLoadError') ||
        this.state.error?.name === 'ChunkLoadError'

      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 rounded-xl bg-white/[0.03] border border-white/[0.08] gap-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-slate-200">
              {isChunkError ? 'Failed to load component' : 'Something went wrong'}
            </p>
            <p className="text-xs text-slate-500">
              {isChunkError
                ? 'The component failed to load. This may be due to a network issue or the dev server was restarted.'
                : this.state.error?.message || 'An unexpected error occurred.'}
            </p>
          </div>
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 rounded-lg text-sm font-medium
                       bg-teal-500/20 text-teal-300 border border-teal-500/25
                       hover:bg-teal-500/30 transition-colors"
          >
            Try Again
          </button>
        </div>
      )
    }

    // Use key to force re-mount on retry
    return <div key={this.state.retryCount}>{this.props.children}</div>
  }
}
