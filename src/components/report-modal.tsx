'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Flag, Loader2, AlertTriangle, User, MessageSquare, Users } from 'lucide-react'

interface ReportModalProps {
  isOpen: boolean
  onClose: () => void
  type: 'user' | 'persona' | 'dm_message' | 'storyline_message'
  reportedId?: string // User ID being reported
  referenceId?: string // Message ID or Persona ID
  reportedName?: string // Name to show in the modal
  messagePreview?: string // Preview of message if reporting a message
}

const REPORT_REASONS = [
  { value: 'harassment', label: 'Harassment or Bullying' },
  { value: 'spam', label: 'Spam or Advertising' },
  { value: 'inappropriate_content', label: 'Inappropriate Content' },
  { value: 'hate_speech', label: 'Hate Speech' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'underage', label: 'Underage User' },
  { value: 'scam_fraud', label: 'Scam or Fraud' },
  { value: 'privacy_violation', label: 'Privacy Violation' },
  { value: 'other', label: 'Other' },
]

export function ReportModal({
  isOpen,
  onClose,
  type,
  reportedId,
  referenceId,
  reportedName,
  messagePreview
}: ReportModalProps) {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason) {
      setError('Please select a reason')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          reportedId: reportedId || null,
          referenceId: referenceId || null,
          reason,
          details: details || null
        })
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        setTimeout(() => {
          onClose()
          setSuccess(false)
          setReason('')
          setDetails('')
        }, 2000)
      } else {
        setError(data.error || 'Failed to submit report')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      onClose()
      setReason('')
      setDetails('')
      setError('')
      setSuccess(false)
    }
  }

  const getTypeIcon = () => {
    switch (type) {
      case 'user':
        return <User className="w-5 h-5" />
      case 'persona':
        return <Users className="w-5 h-5" />
      case 'dm_message':
      case 'storyline_message':
        return <MessageSquare className="w-5 h-5" />
      default:
        return <Flag className="w-5 h-5" />
    }
  }

  const getTypeLabel = () => {
    switch (type) {
      case 'user':
        return 'Report User'
      case 'persona':
        return 'Report Persona'
      case 'dm_message':
        return 'Report Message'
      case 'storyline_message':
        return 'Report Message'
      default:
        return 'Submit Report'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-[#0e1015] border-white/[0.08] text-slate-100 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-300">
            <Flag className="w-5 h-5" />
            {getTypeLabel()}
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            {reportedName && (
              <span>
                Reporting: <span className="text-slate-200 font-medium">{reportedName}</span>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <Flag className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-emerald-300 mb-2">Report Submitted</h3>
            <p className="text-sm text-slate-500">
              Thank you for your report. Our moderation team will review it shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Message Preview */}
            {messagePreview && (
              <div className="p-3 rounded-lg bg-white/[0.05] border border-white/[0.08]">
                <p className="text-xs text-slate-500 mb-1">Message:</p>
                <p className="text-sm text-slate-200 line-clamp-3">"{messagePreview}"</p>
              </div>
            )}

            {/* Reason Selection */}
            <div className="space-y-2">
              <label className="text-sm text-slate-300 font-medium">Reason *</label>
              <div className="grid grid-cols-2 gap-2">
                {REPORT_REASONS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setReason(r.value)}
                    className={`px-3 py-2 rounded-lg text-sm text-left transition-all ${
                      reason === r.value
                        ? 'bg-red-500/20 border border-red-500/40 text-red-200'
                        : 'bg-white/[0.03] border border-white/[0.08] text-slate-300 hover:bg-white/[0.05]'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Additional Details */}
            <div className="space-y-2">
              <label className="text-sm text-slate-300 font-medium">
                Additional Details
                <span className="text-slate-500 font-normal"> (optional)</span>
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Provide any additional context that might help our moderators..."
                className="w-full h-24 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-slate-100 placeholder:text-slate-400/40 focus:border-teal-500 focus:outline-none resize-none text-sm"
                maxLength={1000}
              />
              <p className="text-xs text-slate-400/40 text-right">{details.length}/1000</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={isSubmitting}
                className="flex-1 text-slate-300 hover:text-slate-100 hover:bg-white/[0.05]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !reason}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Flag className="w-4 h-4 mr-2" />
                    Submit Report
                  </>
                )}
              </Button>
            </div>

            {/* Info Note */}
            <p className="text-xs text-slate-400/40 text-center">
              False reports may result in account penalties. Please only report genuine violations.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
