'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Search, X, SlidersHorizontal, ChevronDown, ChevronUp, 
  Hash, TrendingUp, ChevronRight
} from 'lucide-react'
import { STORYLINE_CATEGORIES } from '@/lib/constants'

// Search field options for storylines
const SEARCH_FIELDS = [
  { value: 'all', label: 'All Fields' },
  { value: 'name', label: 'Name' },
  { value: 'description', label: 'Description' },
  { value: 'lore', label: 'Lore / World' },
  { value: 'tags', label: 'Tags' },
  { value: 'category', label: 'Category' }
]

interface PopularTag {
  tag: string
  count: number
}

interface StorylineSearchFilters {
  query: string
  searchIn: string[]
  category: string | null
  tags: string[]
}

interface StorylineAdvancedSearchProps {
  onSearch: (filters: StorylineSearchFilters) => void
  popularTags?: PopularTag[]
  featuredCategories?: PopularTag[]
  isLoading?: boolean
}

export function StorylineAdvancedSearch({ onSearch, popularTags = [], featuredCategories = [], isLoading }: StorylineAdvancedSearchProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [showAllFeaturedTags, setShowAllFeaturedTags] = useState(false)
  const [filters, setFilters] = useState<StorylineSearchFilters>({
    query: '',
    searchIn: ['all'],
    category: null,
    tags: []
  })
  
  // Tag input state
  const [tagInput, setTagInput] = useState('')
  
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      onSearch(filters)
    }, 300)
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [filters])
  
  const updateFilter = <K extends keyof StorylineSearchFilters>(key: K, value: StorylineSearchFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }
  
  const addTagToFilter = () => {
    const tag = tagInput.trim().toLowerCase()
    // Remove emojis and limit length
    const cleanTag = tag.replace(/[\p{Emoji}]/gu, '').slice(0, 20)
    if (cleanTag && !filters.tags.includes(cleanTag)) {
      setFilters(prev => ({
        ...prev,
        tags: [...prev.tags, cleanTag]
      }))
    }
    setTagInput('')
  }
  
  const removeTagFromFilter = (tag: string) => {
    setFilters(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }))
  }
  
  const clearAllFilters = () => {
    setFilters({
      query: '',
      searchIn: ['all'],
      category: null,
      tags: []
    })
    setTagInput('')
  }
  
  const hasActiveFilters = 
    filters.query || 
    filters.category !== null ||
    filters.tags.length > 0
  
  const activeFilterCount = 
    (filters.query ? 1 : 0) +
    (filters.category !== null ? 1 : 0) +
    filters.tags.length

  const displayedCategories = showAllCategories 
    ? STORYLINE_CATEGORIES 
    : STORYLINE_CATEGORIES.slice(0, 7)

  // Featured categories are tags that are used frequently (from popularTags)
  const featuredTags = featuredCategories.length > 0 ? featuredCategories : popularTags.slice(0, 15)
  const displayedFeaturedTags = showAllFeaturedTags 
    ? featuredTags 
    : featuredTags.slice(0, 8)

  return (
    <div className="space-y-3">
      {/* Main Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            type="text"
            placeholder="Search storylines by name, description, lore..."
            value={filters.query}
            onChange={(e) => updateFilter('query', e.target.value)}
            className="pl-10 pr-4 h-10 bg-slate-900/20 border-white/[0.08] text-slate-100 placeholder:text-slate-400/40 focus:border-teal-500/25"
          />
          {filters.query && (
            <button
              onClick={() => updateFilter('query', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <Button
          variant="outline"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`h-10 px-3 border-white/[0.08] ${showAdvanced ? 'bg-teal-500/15 border-teal-500/25' : 'bg-slate-900/20'}`}
        >
          <SlidersHorizontal className="w-4 h-4 mr-2" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full bg-teal-500 text-white text-xs">
              {activeFilterCount}
            </span>
          )}
          {showAdvanced ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
        </Button>
      </div>
      
      {/* Advanced Filters Panel */}
      {showAdvanced && (
        <div className="p-4 bg-slate-900/10 border border-white/[0.08] rounded-xl space-y-4">
          {/* Search In Field */}
          <div>
            <label className="text-xs font-medium text-slate-300 mb-2 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5" />
              Search In
            </label>
            <div className="flex flex-wrap gap-2">
              {SEARCH_FIELDS.map(field => (
                <button
                  key={field.value}
                  onClick={() => {
                    if (field.value === 'all') {
                      updateFilter('searchIn', ['all'])
                    } else {
                      const current = filters.searchIn.includes('all') ? [] : filters.searchIn
                      const newFields = current.includes(field.value)
                        ? current.filter(f => f !== field.value)
                        : [...current, field.value]
                      updateFilter('searchIn', newFields.length > 0 ? newFields : ['all'])
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    filters.searchIn.includes(field.value) || (field.value === 'all' && filters.searchIn.includes('all'))
                      ? 'bg-teal-500/20 text-slate-200 border border-teal-500/25'
                      : 'bg-white/[0.05] text-slate-400 border border-white/[0.08] hover:border-teal-500/20'
                  }`}
                >
                  {field.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Category Filter */}
          <div>
            <label className="text-xs font-medium text-slate-300 mb-2 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5" />
              Category
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => updateFilter('category', null)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filters.category === null
                    ? 'bg-teal-500 text-white shadow-md'
                    : 'bg-white/[0.08] text-slate-300 hover:bg-teal-500/25'
                }`}
              >
                All
              </button>
              {displayedCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => updateFilter('category', filters.category === cat ? null : cat)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    filters.category === cat
                      ? 'bg-teal-500 text-white shadow-md'
                      : 'bg-white/[0.08] text-slate-300 hover:bg-teal-500/25'
                  }`}
                >
                  {cat}
                </button>
              ))}
              {STORYLINE_CATEGORIES.length > 7 && (
                <button
                  onClick={() => setShowAllCategories(!showAllCategories)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/[0.03] text-slate-400 hover:bg-white/[0.08] flex items-center gap-1"
                >
                  {showAllCategories ? (
                    <>
                      <ChevronUp className="w-3 h-3" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3" />
                      +{STORYLINE_CATEGORIES.length - 7} More
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
          
          {/* Featured / Popular Tags */}
          {featuredTags.length > 0 && (
            <div>
              <label className="text-xs font-medium text-slate-300 mb-2 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                Featured Tags
                <span className="text-slate-500 font-normal">- Most used by storylines</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {displayedFeaturedTags.map(({ tag, count }) => (
                  <button
                    key={tag}
                    onClick={() => {
                      if (filters.tags.includes(tag)) {
                        removeTagFromFilter(tag)
                      } else {
                        setFilters(prev => ({
                          ...prev,
                          tags: [...prev.tags, tag]
                        }))
                      }
                    }}
                    className={`px-2 py-1 rounded-full text-xs transition-all flex items-center gap-1 ${
                      filters.tags.includes(tag)
                        ? 'bg-fuchsia-500/30 text-fuchsia-200 border border-fuchsia-500/40'
                        : 'bg-white/[0.05] text-slate-400 border border-white/[0.08] hover:border-teal-500/20'
                    }`}
                  >
                    {tag}
                    <span className="text-slate-500 text-[10px]">({count})</span>
                  </button>
                ))}
                {featuredTags.length > 8 && (
                  <button
                    onClick={() => setShowAllFeaturedTags(!showAllFeaturedTags)}
                    className="px-2 py-1 rounded-full text-xs font-medium bg-white/[0.03] text-slate-400 hover:bg-white/[0.08] flex items-center gap-1 border border-white/[0.06]"
                  >
                    {showAllFeaturedTags ? (
                      <>
                        <ChevronUp className="w-3 h-3" />
                        Show Less
                      </>
                    ) : (
                      <>
                        <ChevronRight className="w-3 h-3" />
                        +{featuredTags.length - 8} More
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
          
          {/* Custom Tag Input */}
          <div>
            <label className="text-xs font-medium text-slate-300 mb-2 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5" />
              Filter by Custom Tags
            </label>
            <div className="flex gap-2 mb-2">
              <Input
                type="text"
                placeholder="Add tag (no emojis, max 20 chars)..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTagToFilter())}
                className="flex-1 h-8 bg-slate-900/20 border-white/[0.08] text-slate-100 text-sm"
                maxLength={20}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={addTagToFilter}
                className="h-8 px-3 border-white/[0.08]"
              >
                Add
              </Button>
            </div>
            {filters.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {filters.tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-300 text-xs"
                  >
                    {tag}
                    <button onClick={() => removeTagFromFilter(tag)} className="hover:text-red-400">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          
          {/* Clear Filters */}
          {hasActiveFilters && (
            <div className="pt-2 border-t border-white/[0.06]">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-slate-400 hover:text-red-400 hover:bg-red-500/10"
              >
                <X className="w-4 h-4 mr-2" />
                Clear All Filters ({activeFilterCount})
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export type { StorylineSearchFilters }
