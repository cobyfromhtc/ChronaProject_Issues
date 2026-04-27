'use client'

import { useState, useEffect, startTransition } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Search, Download, Star, ChevronLeft, ChevronRight, User, 
  Coins, Loader2, Check
} from 'lucide-react'
import { MarketplacePersonaModal } from '@/components/marketplace-persona-modal'
import { apiFetch } from '@/lib/api-client'
import { useVariantAccent } from '@/lib/ui-variant-styles'

interface MarketplaceListing {
  id: string
  name: string
  avatarUrl: string | null
  description: string | null
  tags: string | null
  price: number
  downloads: number
  purchaseCount: number
  createdAt: string
  creator: {
    id: string
    username: string
    avatarUrl: string | null
  }
  persona?: any
  hasPurchased?: boolean
  isOwner?: boolean
  showFullDetails?: boolean
}

// Archetype icons and colors
const ARCHETYPE_CONFIG: Record<string, { icon: string; color: string; bgColor: string }> = {
  'All': { icon: '✨', color: 'text-slate-300', bgColor: 'bg-teal-500/15' },
  'Hero': { icon: '⚔️', color: 'text-blue-400', bgColor: 'bg-blue-500/30' },
  'Villain': { icon: '💀', color: 'text-red-400', bgColor: 'bg-red-500/30' },
  'Antihero': { icon: '🦹', color: 'text-gray-400', bgColor: 'bg-gray-500/30' },
  'Mentor': { icon: '🧙', color: 'text-slate-400', bgColor: 'bg-teal-500/20' },
  'Sidekick': { icon: '🤝', color: 'text-green-400', bgColor: 'bg-green-500/30' },
  'Trickster': { icon: '🃏', color: 'text-amber-400', bgColor: 'bg-amber-500/30' },
  'Lover': { icon: '💕', color: 'text-pink-400', bgColor: 'bg-pink-500/30' },
  'Everyman': { icon: '👤', color: 'text-slate-400', bgColor: 'bg-slate-500/30' },
  'Rebel': { icon: '🔥', color: 'text-orange-400', bgColor: 'bg-orange-500/30' },
  'Creator': { icon: '🎨', color: 'text-cyan-400', bgColor: 'bg-cyan-500/30' },
  'Caregiver': { icon: '💝', color: 'text-rose-400', bgColor: 'bg-rose-500/30' },
  'Explorer': { icon: '🗺️', color: 'text-emerald-400', bgColor: 'bg-emerald-500/30' },
  'Sage': { icon: '📚', color: 'text-indigo-400', bgColor: 'bg-indigo-500/30' },
  'Innocent': { icon: '🌸', color: 'text-pink-300', bgColor: 'bg-pink-400/30' },
  'Ruler': { icon: '👑', color: 'text-yellow-400', bgColor: 'bg-yellow-500/30' },
  'Other': { icon: '📖', color: 'text-gray-400', bgColor: 'bg-gray-500/30' },
}

export function MarketplacePage() {
  const { user } = useAuth()
  const accent = useVariantAccent()
  
  const [listings, setListings] = useState<MarketplaceListing[]>([])
  const [featuredListings, setFeaturedListings] = useState<MarketplaceListing[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('popular')
  const [selectedArchetype, setSelectedArchetype] = useState('All')
  const [downloadableOnly, setDownloadableOnly] = useState(false)
  
  // Detail modal
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [purchaseError, setPurchaseError] = useState('')
  
  // Fetch marketplace listings
  const fetchListings = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.set('search', searchQuery)
      params.set('sortBy', sortBy === 'popular' ? 'popular' : sortBy === 'newest' ? 'newest' : 'popular')
      if (downloadableOnly) params.set('priceMax', '0')
      if (selectedArchetype !== 'All') params.set('tag', selectedArchetype)
      
      const response = await apiFetch(`/api/marketplace?${params}`)
      if (response.ok) {
        const data = await response.json()
        setListings(data.listings)
        // Set first 4 as featured
        setFeaturedListings(data.listings.slice(0, 4))
      }
    } catch (error) {
      console.error('Failed to fetch marketplace:', error)
    } finally {
      setIsLoading(false)
    }
  }
  
  useEffect(() => {
    startTransition(() => { fetchListings() })
  }, [sortBy, selectedArchetype, downloadableOnly])
  
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 || searchQuery.length === 0) {
        fetchListings()
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])
  
  // Fetch listing details
  const fetchListingDetails = async (listingId: string) => {
    try {
      const response = await apiFetch(`/api/marketplace/${listingId}`)
      if (response.ok) {
        const data = await response.json()
        setSelectedListing(data.listing)
        setShowDetailModal(true)
      }
    } catch (error) {
      console.error('Failed to fetch listing details:', error)
    }
  }
  
  // Purchase listing
  const handlePurchase = async () => {
    if (!selectedListing || !user) return
    
    setIsPurchasing(true)
    setPurchaseError('')
    
    try {
      const response = await apiFetch(`/api/marketplace/${selectedListing.id}/purchase`, {
        method: 'POST',
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setShowDetailModal(false)
        setSelectedListing(null)
        fetchListings()
      } else {
        setPurchaseError(data.error || 'Failed to complete purchase')
      }
    } catch (error) {
      console.error('Purchase error:', error)
      setPurchaseError('Failed to complete purchase')
    } finally {
      setIsPurchasing(false)
    }
  }
  
  // Get archetype config
  const getArchetypeConfig = (tag: string) => {
    const normalizedTag = tag?.toLowerCase() || ''
    for (const [key, config] of Object.entries(ARCHETYPE_CONFIG)) {
      if (normalizedTag.includes(key.toLowerCase())) {
        return config
      }
    }
    return ARCHETYPE_CONFIG['Other']
  }
  
  // Format archetype from tags
  const getArchetype = (tags: string | null) => {
    if (!tags) return 'Other'
    const firstTag = tags.split(',')[0]?.trim()
    return firstTag || 'Other'
  }

  return (
    <div className={`flex h-full ${accent.bgSurfaceDeep}`}>
      {/* Left Sidebar */}
      <div className="w-64 border-r border-white/[0.06] bg-[#0e1015] flex flex-col flex-shrink-0">
        {/* Fixed filters at top */}
        <div className="p-4 space-y-5 flex-shrink-0">
          {/* Search */}
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400/40" />
              <input
                type="text"
                placeholder="Search personas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full ${accent.bgSurface} border border-white/[0.08] rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-400/40 focus:outline-none focus:ring-2 focus:${accent.ringFocus}`}
              />
            </div>
          </div>
          
          {/* Sort */}
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
              Sort
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={`w-full ${accent.bgSurface} border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:${accent.ringFocus} appearance-none cursor-pointer`}
            >
              <option value="popular">Most Popular</option>
              <option value="newest">Newest</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
            </select>
          </div>
          
          {/* Download Filter */}
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
              Download
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-5 h-5 rounded border ${downloadableOnly ? `${accent.bgSolid} ${accent.borderStrong}` : `${accent.bgSurface} ${accent.borderSubtle}`} flex items-center justify-center transition-colors`}>
                {downloadableOnly && <Check className="w-3 h-3 text-white" />}
              </div>
              <input
                type="checkbox"
                checked={downloadableOnly}
                onChange={(e) => setDownloadableOnly(e.target.checked)}
                className="sr-only"
              />
              <span className="text-sm text-slate-300/80 group-hover:text-slate-200 transition-colors">
                Free / Downloadable
              </span>
            </label>
          </div>
        </div>

        {/* Archetype - fills remaining space */}
        <div className="flex-1 min-h-0 flex flex-col px-4 pb-4">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block flex-shrink-0">
            Archetype
          </label>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 pr-1">
            {Object.entries(ARCHETYPE_CONFIG).map(([name, config]) => (
              <button
                key={name}
                onClick={() => setSelectedArchetype(name)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                  selectedArchetype === name
                    ? `${accent.bgTint} ${accent.text} border ${accent.borderSubtle}`
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]'
                }`}
              >
                <span className="text-base">{config.icon}</span>
                <span className="font-medium">{name}</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Chronos Balance */}
        {user && (
          <div className="p-4 border-t border-white/[0.06] bg-[#0e1015]/80 flex-shrink-0">
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Coins className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-xs text-amber-400/70">Your Balance</p>
                <p className="text-lg font-bold text-amber-300">{user.chronos || 0} Chronos</p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-8">
            {/* Featured Section */}
            {featuredListings.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                      <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                      FEATURED
                    </h2>
                    <p className="text-sm text-slate-500">Handpicked identities worth exploring</p>
                  </div>
                  <div className="flex gap-2">
                    <button className={`w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:${accent.bgTint} transition-colors`}>
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button className={`w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:${accent.bgTint} transition-colors`}>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                  {featuredListings.map((listing) => {
                    const archetype = getArchetype(listing.tags)
                    const config = getArchetypeConfig(archetype)
                    const isNew = new Date(listing.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    
                    return (
                      <div
                        key={listing.id}
                        onClick={() => fetchListingDetails(listing.id)}
                        className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/20"
                      >
                        {/* Card Background with Gradient Border */}
                        <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${accent.fromSubtle} ${accent.toSubtle} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                        <div className={`relative ${accent.bgSurface} rounded-2xl border border-white/[0.08] group-hover:${accent.borderSubtle} overflow-hidden h-full`}>
                          
                          {/* Image Container */}
                          <div className="aspect-[4/5] relative overflow-hidden">
                            {listing.avatarUrl ? (
                              <img
                                src={listing.avatarUrl}
                                alt={listing.name}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                              />
                            ) : (
                              <div className={`w-full h-full bg-gradient-to-br ${accent.fromSubtle} ${accent.toSubtle} flex items-center justify-center`}>
                                <User className="w-20 h-20 text-slate-400/30" />
                              </div>
                            )}
                            
                            {/* Overlay Gradient */}
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0f1117] via-[#0f1117]/40 to-transparent" />
                            
                            {/* Shimmer Effect on Hover */}
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                            </div>
                            
                            {/* Badges Container */}
                            <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
                              {/* Archetype Badge */}
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold backdrop-blur-md ${config.bgColor}/80 ${config.color} border border-current/20`}>
                                {config.icon} {archetype.toUpperCase()}
                              </span>
                              
                              {/* NEW Badge */}
                              {isNew && (
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold bg-gradient-to-r ${accent.from} ${accent.to} text-white shadow-lg ${accent.shadowGlow}`}>
                                  NEW
                                </span>
                              )}
                            </div>
                            
                            {/* Price Tag - Bottom Right of Image */}
                            <div className="absolute bottom-3 right-3">
                              {listing.price === 0 ? (
                                <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/90 text-white shadow-lg shadow-emerald-500/30 backdrop-blur-sm">
                                  FREE
                                </span>
                              ) : (
                                <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30 flex items-center gap-1">
                                  <Coins className="w-3 h-3" />
                                  {listing.price}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Content Section */}
                          <div className="p-4 -mt-4 relative">
                            {/* Name & Creator */}
                            <h3 className="font-bold text-slate-100 text-base truncate group-hover:text-white transition-colors">
                              {listing.name}
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">by <span className="text-slate-300">@{listing.creator.username}</span></p>
                            
                            {/* Stats Row */}
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.06]">
                              {/* Rating */}
                              <div className="flex items-center gap-1">
                                <div className="flex items-center">
                                  {[1,2,3,4,5].map((star) => (
                                    <Star key={star} className="w-3 h-3 text-amber-400 fill-amber-400/50" />
                                  ))}
                                </div>
                                <span className="text-[10px] text-slate-500 ml-1">5.0</span>
                              </div>
                              
                              {/* Downloads */}
                              <div className="flex items-center gap-1 text-slate-500">
                                <Download className="w-3.5 h-3.5" />
                                <span className="text-xs">{listing.downloads + listing.purchaseCount}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
            
            {/* All Personas Section */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-100">
                    ALL PERSONAS
                  </h2>
                  <p className="text-sm text-slate-500">Browse the complete identity catalogue</p>
                </div>
              </div>
              
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
                </div>
              ) : listings.length === 0 ? (
                <div className={`text-center py-16 ${accent.bgSurface} rounded-xl border border-white/[0.06]`}>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/[0.05] flex items-center justify-center">
                    <Search className="w-8 h-8 text-slate-500" />
                  </div>
                  <p className="text-slate-200 font-medium">No personas found</p>
                  <p className="text-slate-500 text-sm mt-1">Try adjusting your filters or search</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {listings.map((listing) => {
                    const archetype = getArchetype(listing.tags)
                    const config = getArchetypeConfig(archetype)
                    const isNew = new Date(listing.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    
                    return (
                      <div
                        key={listing.id}
                        onClick={() => fetchListingDetails(listing.id)}
                        className="group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20"
                      >
                        {/* Card Background */}
                        <div className={`relative ${accent.bgSurface} rounded-xl border border-white/[0.08] group-hover:border-white/[0.12] overflow-hidden h-full`}>
                          
                          {/* Image Container */}
                          <div className="aspect-[4/5] relative overflow-hidden">
                            {listing.avatarUrl ? (
                              <img
                                src={listing.avatarUrl}
                                alt={listing.name}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                              />
                            ) : (
                              <div className={`w-full h-full bg-gradient-to-br ${accent.fromSubtle} ${accent.toSubtle} flex items-center justify-center`}>
                                <User className="w-14 h-14 text-slate-400/25" />
                              </div>
                            )}
                            
                            {/* Overlay Gradient */}
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0f1117] via-[#0f1117]/30 to-transparent" />
                            
                            {/* Badges */}
                            <div className="absolute top-2 left-2 right-2 flex items-start justify-between">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold backdrop-blur-sm ${config.bgColor}/70 ${config.color}`}>
                                {config.icon} {archetype.toUpperCase()}
                              </span>
                              {isNew && (
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-gradient-to-r ${accent.from} ${accent.to} text-white`}>
                                  NEW
                                </span>
                              )}
                            </div>
                            
                            {/* Price Tag */}
                            <div className="absolute bottom-2 right-2">
                              {listing.price === 0 ? (
                                <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-500/80 text-white backdrop-blur-sm">
                                  FREE
                                </span>
                              ) : (
                                <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-amber-500/80 text-white flex items-center gap-0.5 backdrop-blur-sm">
                                  <Coins className="w-2.5 h-2.5" />
                                  {listing.price}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Content */}
                          <div className="p-3 -mt-3 relative">
                            <h3 className="font-semibold text-slate-100 text-sm truncate group-hover:text-white transition-colors">
                              {listing.name}
                            </h3>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              by <span className="text-slate-300/80">@{listing.creator.username}</span>
                            </p>
                            
                            {listing.description && (
                              <p className="text-[10px] text-slate-300/50 mt-1.5 line-clamp-2 leading-relaxed">
                                {listing.description}
                              </p>
                            )}
                            
                            {/* Stats */}
                            <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/[0.06]">
                              <div className="flex items-center gap-1 text-slate-500">
                                <Download className="w-3 h-3" />
                                <span className="text-[10px]">{listing.downloads + listing.purchaseCount}</span>
                              </div>
                              <div className="flex items-center gap-0.5">
                                <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400/40" />
                                <span className="text-[10px] text-slate-500">5.0</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        </ScrollArea>
      </div>
      
      {/* Marketplace Persona Modal */}
      <MarketplacePersonaModal
        listing={selectedListing}
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false)
          setSelectedListing(null)
          setPurchaseError('')
        }}
        onPurchase={handlePurchase}
        isPurchasing={isPurchasing}
        purchaseError={purchaseError}
      />
    </div>
  )
}
