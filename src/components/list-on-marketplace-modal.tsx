'use client'

import { useState, useEffect, startTransition } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  Coins, Loader2, Sparkles, Check, Info, AlertCircle, Tag, Bell, BellOff
} from 'lucide-react'
import { Persona } from '@/stores/persona-store'

interface ListOnMarketplaceModalProps {
  isOpen: boolean
  onClose: () => void
  persona: Persona | null
  onSuccess?: () => void
}

const ARCHETYPES = ['Hero', 'Villain', 'Antihero', 'Mentor', 'Sidekick', 'Trickster', 'Lover', 'Everyman', 'Rebel', 'Creator', 'Caregiver', 'Explorer', 'Sage', 'Innocent', 'Ruler', 'Other']

export function ListOnMarketplaceModal({ isOpen, onClose, persona, onSuccess }: ListOnMarketplaceModalProps) {
  const [price, setPrice] = useState('0')
  const [description, setDescription] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [notifyOnPurchase, setNotifyOnPurchase] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  
  // Reset form when modal opens with a new persona
  useEffect(() => {
    if (persona && isOpen) {
      startTransition(() => {
        setDescription(persona.description || '')
        setSelectedTags(persona.archetype ? [persona.archetype] : [])
        setPrice('0')
        setNotifyOnPurchase(true)
        setError('')
        setSuccess(false)
      })
    }
  }, [persona, isOpen])
  
  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }
  
  const handleSubmit = async () => {
    if (!persona) return
    
    // Validate price
    const numPrice = parseInt(price) || 0
    if (numPrice < 0) {
      setError('Price cannot be negative')
      return
    }
    if (numPrice > 430) {
      setError('Maximum price is 430 Chronos')
      return
    }
    
    setIsSubmitting(true)
    setError('')
    
    try {
      const response = await fetch('/api/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId: persona.id,
          description: description || persona.description,
          tags: selectedTags.length > 0 ? selectedTags.join(', ') : persona.archetype,
          price: numPrice,
          notifyOnPurchase,
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to list persona')
      }
      
      setSuccess(true)
      setTimeout(() => {
        onSuccess?.()
        onClose()
        // Reset state
        setPrice('0')
        setDescription('')
        setSelectedTags([])
        setSuccess(false)
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list persona')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const handleClose = () => {
    if (!isSubmitting) {
      onClose()
      setError('')
      setSuccess(false)
    }
  }
  
  if (!persona) return null
  
  const numPrice = parseInt(price) || 0
  const creatorEarnings = Math.floor(numPrice * 0.9)
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0 overflow-hidden bg-[#0f1117] border-white/[0.08] flex flex-col">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16 border-2 border-teal-500/20">
              <AvatarImage src={persona.avatarUrl || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-teal-500 to-cyan-400 text-white text-xl font-semibold">
                {persona.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className="text-xl font-bold persona-gradient-text flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-slate-400" />
                List on Marketplace
              </DialogTitle>
              <DialogDescription className="text-slate-500 mt-1">
                Share <span className="text-slate-300 font-medium">{persona.name}</span> with the community
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        {/* Content - Scrollable */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
          {/* Success State */}
          {success && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-100">Listed Successfully!</h3>
              <p className="text-sm text-slate-500 mt-1">Your persona is now on the marketplace</p>
            </div>
          )}
          
          {!success && (
            <>
              {/* Price */}
              <div className="space-y-2">
                <Label className="text-slate-200/80 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-400" />
                  Price in Chronos
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max="430"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0"
                    className="h-12 text-2xl font-bold text-center bg-white/[0.03] border-white/[0.08] text-slate-100 placeholder:text-slate-400/40 focus:border-teal-500/25"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                    Max: 430
                  </span>
                </div>
                {numPrice > 0 && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <Info className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <p className="text-xs text-amber-300/80">
                      You&apos;ll earn <span className="font-bold text-amber-300">{creatorEarnings} Chronos</span> (90%) from each sale
                    </p>
                  </div>
                )}
                {numPrice === 0 && (
                  <p className="text-xs text-slate-500">Free personas get more downloads!</p>
                )}
              </div>
              
              {/* Notification Toggle */}
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/[0.08]">
                  <div className="flex items-center gap-3">
                    {notifyOnPurchase ? (
                      <Bell className="w-5 h-5 text-slate-400" />
                    ) : (
                      <BellOff className="w-5 h-5 text-slate-500" />
                    )}
                    <div>
                      <Label className="text-slate-200/80 cursor-pointer">
                        Notify me when downloaded
                      </Label>
                      <p className="text-xs text-slate-500">
                        Get a Blorp DM when someone downloads your persona
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={notifyOnPurchase}
                    onCheckedChange={setNotifyOnPurchase}
                  />
                </div>
              </div>
              
              {/* Description */}
              <div className="space-y-2">
                <Label className="text-slate-200/80">Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={persona.description || "Describe your persona for the marketplace..."}
                  className="min-h-[80px] bg-white/[0.03] border-white/[0.08] text-slate-100 placeholder:text-slate-400/40 resize-none"
                  maxLength={500}
                />
                <p className="text-xs text-slate-500 text-right">{description.length}/500</p>
              </div>
              
              {/* Tags (Archetypes) */}
              <div className="space-y-2">
                <Label className="text-slate-200/80 flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Archetype Tags
                </Label>
                <div className="flex flex-wrap gap-2">
                  {ARCHETYPES.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleTagToggle(tag)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        selectedTags.includes(tag)
                          ? 'bg-teal-500/20 text-slate-100 border border-teal-500/25'
                          : 'bg-white/[0.03] text-slate-300/70 border border-white/[0.08] hover:bg-white/[0.05]'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                {selectedTags.length === 0 && (
                  <p className="text-xs text-slate-500">Select at least one archetype</p>
                )}
              </div>
              
              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              
              {/* Info Box */}
              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <p className="text-xs text-slate-500 leading-relaxed">
                  By listing this persona, you agree to share it with the Chrona community. 
                  You can update or remove your listing at any time from your profile.
                </p>
              </div>
            </>
          )}
        </div>
        
        {/* Footer - Fixed at bottom */}
        {!success && (
          <div className="p-6 pt-4 flex gap-3 border-t border-white/[0.06] flex-shrink-0 bg-[#0f1117]">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 border-white/[0.08] text-slate-300 hover:bg-white/[0.05]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || selectedTags.length === 0}
              className="flex-1 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Listing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  List on Marketplace
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
