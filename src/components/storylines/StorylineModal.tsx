'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  VisuallyHidden,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Users,
  Star,
  Calendar,
  UserPlus,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Flag,
  Sparkles,
  Globe,
  Lock,
  Crown,
} from 'lucide-react';
import type { StorylineServer } from './StorylineServerCard';
import { useVariantAccent } from '@/lib/ui-variant-styles';

interface Review {
  id: string;
  rating: number;
  content: string;
  createdAt: string;
  user: {
    id: string;
    name?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
  };
}

interface StorylineModalProps {
  server: StorylineServer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId?: string;
  onEnterStoryline?: (storylineId: string) => void;
}

const genreConfig: Record<string, { color: string; bg: string; border: string; gradient: string }> = {
  Fantasy: { color: 'text-slate-300', bg: 'bg-orange-500/15', border: 'border-white/[0.10]', gradient: 'from-orange-600/15 to-amber-600/10' },
  'Sci-Fi': { color: 'text-cyan-300', bg: 'bg-cyan-500/15', border: 'border-cyan-500/25', gradient: 'from-cyan-600/20 to-blue-600/15' },
  Horror: { color: 'text-red-300', bg: 'bg-red-500/15', border: 'border-red-500/25', gradient: 'from-red-600/20 to-rose-600/15' },
  Romance: { color: 'text-pink-300', bg: 'bg-pink-500/15', border: 'border-pink-500/25', gradient: 'from-pink-600/20 to-rose-600/15' },
  Mystery: { color: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/25', gradient: 'from-amber-600/20 to-orange-600/15' },
  Adventure: { color: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/25', gradient: 'from-emerald-600/20 to-amber-600/15' },
  Drama: { color: 'text-violet-300', bg: 'bg-violet-500/15', border: 'border-violet-500/25', gradient: 'from-violet-600/20 to-purple-600/15' },
  'Slice of Life': { color: 'text-rose-300', bg: 'bg-rose-500/15', border: 'border-rose-500/25', gradient: 'from-rose-600/20 to-pink-600/15' },
  Comedy: { color: 'text-yellow-300', bg: 'bg-yellow-500/15', border: 'border-yellow-500/25', gradient: 'from-yellow-600/20 to-amber-600/15' },
  Action: { color: 'text-orange-300', bg: 'bg-orange-500/15', border: 'border-orange-500/25', gradient: 'from-orange-600/20 to-red-600/15' },
  Thriller: { color: 'text-slate-300', bg: 'bg-slate-500/15', border: 'border-slate-500/25', gradient: 'from-slate-600/20 to-gray-600/15' },
  Supernatural: { color: 'text-indigo-300', bg: 'bg-indigo-500/15', border: 'border-indigo-500/25', gradient: 'from-indigo-600/20 to-violet-600/15' },
  Historical: { color: 'text-stone-300', bg: 'bg-stone-500/15', border: 'border-stone-500/25', gradient: 'from-stone-600/20 to-amber-600/15' },
  Other: { color: 'text-gray-300', bg: 'bg-gray-500/15', border: 'border-gray-500/25', gradient: 'from-gray-600/20 to-slate-600/15' },
};

const defaultCovers: Record<string, string> = {
  Fantasy: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&h=400&fit=crop',
  'Sci-Fi': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=400&fit=crop',
  Horror: 'https://images.unsplash.com/photo-1509248961725-9d3c0c7a8f5b?w=800&h=400&fit=crop',
  Romance: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=800&h=400&fit=crop',
  Mystery: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=400&fit=crop',
  Adventure: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&h=400&fit=crop',
  Drama: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&h=400&fit=crop',
};

export function StorylineModal({
  server,
  open,
  onOpenChange,
  currentUserId = 'demo-user',
  onEnterStoryline,
}: StorylineModalProps) {
  const accent = useVariantAccent();
  const [isJoining, setIsJoining] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [serverDetails, setServerDetails] = useState<typeof server & {
    longDescription?: string | null;
    reviews?: Review[];
    owner?: {
      id: string;
      name?: string | null;
      username?: string | null;
      avatar?: string | null;
      bio?: string | null;
    };
    isPublic?: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [newReview, setNewReview] = useState({ rating: 5, content: '' });
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewAverageRating, setReviewAverageRating] = useState(0);

  useEffect(() => {
    if (server && open) {
      fetchServerDetails();
      fetchReviews();
    }
  }, [server, open]);

  const fetchServerDetails = async () => {
    if (!server) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/storylines/${server.id}`);
      if (response.ok) {
        const data = await response.json();
        const storylineData = data.storyline || data;
        setServerDetails(storylineData);
        
        const isMember = storylineData.isMember || storylineData.members?.some(
          (m: { userId?: string; user?: { id: string } }) => m.userId === currentUserId || m.user?.id === currentUserId
        );
        setIsJoined(isMember);
      }
    } catch (error) {
      console.error('Failed to fetch server details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!server || isJoined) return;
    setIsJoining(true);
    try {
      const response = await fetch(`/api/storylines/${server.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
      });

      if (response.ok) {
        setIsJoined(true);
        fetchServerDetails();
        fetchReviews();
      }
    } catch (error) {
      console.error('Failed to join server:', error);
    } finally {
      setIsJoining(false);
    }
  };

  const fetchReviews = async () => {
    if (!server) return;
    try {
      const response = await fetch(`/api/storylines/${server.id}/reviews`);
      if (response.ok) {
        const data = await response.json();
        setReviews(data.reviews || []);
        setReviewAverageRating(data.averageRating || 0);
      }
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
    }
  };

  const handleSubmitReview = async () => {
    if (!server || !newReview.content.trim()) return;
    setIsSubmittingReview(true);
    try {
      const response = await fetch(`/api/storylines/${server.id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: newReview.rating,
          content: newReview.content,
        }),
      });

      if (response.ok) {
        setNewReview({ rating: 5, content: '' });
        fetchReviews();
        fetchServerDetails();
      } else {
        const data = await response.json();
        console.error('Failed to submit review:', data.error);
      }
    } catch (error) {
      console.error('Failed to submit review:', error);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (!server) return null;

  const mappedServerDetails = serverDetails ? {
    ...serverDetails,
    genre: serverDetails.genre || serverDetails.category,
    coverImage: serverDetails.coverImage || serverDetails.bannerUrl,
    iconImage: serverDetails.iconImage || serverDetails.iconUrl,
    memberCount: serverDetails.memberCount || serverDetails._count?.members || 0,
  } : null;

  const displayServer = mappedServerDetails || {
    ...server,
    genre: server.genre || server.category,
    coverImage: server.coverImage || server.bannerUrl,
    iconImage: server.iconImage || server.iconUrl,
    isPublic: server.isPublic ?? true,
  };
  
  const displayName = displayServer.name || 'Untitled Storyline';
  const displayGenre = displayServer.genre || 'Fantasy';
  const displayDescription = displayServer.description || '';
  const genreStyle = genreConfig[displayGenre] || genreConfig.Fantasy;
  const coverImage = displayServer.coverImage || defaultCovers[displayGenre] || defaultCovers.Fantasy;
  const memberCount = displayServer.memberCount || 0;
  const reviewCount = displayServer.reviewCount || reviews.length || 0;
  const isPublic = displayServer.isPublic ?? true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-3xl max-h-[92vh] p-0 gap-0 overflow-hidden 
                   bg-[#100e0d]/90 backdrop-blur-2xl
                   border border-white/[0.08] 
                   shadow-2xl shadow-black/50"
        showCloseButton={false}
      >
        {/* Visually hidden title for accessibility */}
        <VisuallyHidden>
          <DialogTitle>{displayName} - Storyline Details</DialogTitle>
        </VisuallyHidden>
        
        {/* Cover Image Section - Cinematic wider banner */}
        <div className="relative h-52 w-full overflow-hidden">
          <img
            src={coverImage}
            alt={displayName}
            className="h-full w-full object-cover"
          />
          {/* Multi-layer gradient overlay */}
          <div className={`absolute inset-0 bg-gradient-to-t from-[#100e0d] via-[#100e0d]/70 to-transparent`} />
          <div className={`absolute inset-0 bg-gradient-to-r ${genreStyle.gradient}`} />
          
          {/* Decorative top accent line */}
          <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${accent.from} ${accent.to}`} />
          
          {/* Server Icon - Positioned better */}
          <div className="absolute -bottom-10 left-6 z-10">
            <div className="relative">
              <Avatar className="h-20 w-20 border-4 border-[#100e0d] shadow-xl shadow-black/50 ring-2 ring-white/[0.08]">
                <AvatarImage src={displayServer.iconImage || undefined} alt={displayName} />
                <AvatarFallback className={`bg-gradient-to-br ${accent.avatarFrom} ${accent.avatarTo} text-white text-2xl font-bold`}>
                  {displayName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              {/* Online indicator */}
              {isJoined && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-[#100e0d] flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
              )}
            </div>
          </div>
          
          {/* Public/Private badge */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <div className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5
                            backdrop-blur-md
                            ${isPublic 
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20' 
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/20'}`}>
              {isPublic ? (
                <><Globe className="w-3 h-3" /> Public</>
              ) : (
                <><Lock className="w-3 h-3" /> Private</>
              )}
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="pt-14 pb-4">
          {/* Title & Description */}
          <div className="px-6 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-2xl font-bold text-white tracking-tight">{displayName}</h2>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${genreStyle.bg} ${genreStyle.color} ${genreStyle.border} border`}>
                    {displayGenre}
                  </span>
                </div>
                {displayDescription && (
                  <p className="mt-2 text-sm text-slate-400 line-clamp-2 leading-relaxed">
                    {displayDescription}
                  </p>
                )}
              </div>
            </div>

            {/* Stats Bar - Glassmorphism style */}
            <div className="flex flex-wrap items-center gap-4 mt-4 py-3 px-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center">
                  <Users className="h-4 w-4 text-slate-300" />
                </div>
                <div>
                  <p className="text-white font-semibold">{memberCount}</p>
                  <p className="text-xs text-slate-500">members</p>
                </div>
              </div>
              
              <div className="w-px h-8 bg-white/[0.08]" />
              
              <div className="flex items-center gap-2 text-sm">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                </div>
                <div>
                  <p className="text-white font-semibold">
                    {reviewAverageRating > 0 ? reviewAverageRating.toFixed(1) : (displayServer.rating > 0 ? displayServer.rating.toFixed(1) : 'N/A')}
                  </p>
                  <p className="text-xs text-slate-500">{reviewCount} reviews</p>
                </div>
              </div>
              
              <div className="w-px h-8 bg-white/[0.08]" />
              
              <div className="flex items-center gap-2 text-sm">
                <div className={`w-8 h-8 rounded-lg ${accent.bgSubtle} flex items-center justify-center`}>
                  <Calendar className={`h-4 w-4 ${accent.text}`} />
                </div>
                <div>
                  <p className="text-white font-semibold text-xs">
                    {displayServer.createdAt ? new Date(displayServer.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}
                  </p>
                  <p className="text-xs text-slate-500">created</p>
                </div>
              </div>
            </div>

            {/* Owner Info */}
            {displayServer.owner && (
              <div className="flex items-center gap-3 mt-3 text-sm">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-slate-500">Created by</span>
                  <Avatar className="h-5 w-5 ring-1 ring-white/[0.08]">
                    <AvatarImage src={displayServer.owner.avatar || undefined} />
                    <AvatarFallback className={`text-xs ${accent.bgSubtle} ${accent.text}`}>
                      {displayServer.owner.name?.charAt(0) || displayServer.owner.username?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-slate-200">
                    {displayServer.owner.name || displayServer.owner.username || 'Unknown'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="px-6 pb-4">
            {isJoined ? (
              <button
                onClick={() => onEnterStoryline?.(displayServer.id)}
                className={`w-full py-3 px-4 rounded-xl font-semibold text-sm
                           bg-gradient-to-r ${accent.from} ${accent.to} 
                           hover:opacity-90
                           text-white shadow-lg ${accent.shadowGlow}
                           transition-all duration-200 flex items-center justify-center gap-2`}
              >
                <MessageSquare className="w-4 h-4" />
                Enter Storyline
              </button>
            ) : (
              <button
                onClick={handleJoin}
                disabled={isJoining}
                className={`w-full py-3 px-4 rounded-xl font-semibold text-sm
                           bg-gradient-to-r ${accent.from} ${accent.to} 
                           hover:opacity-90
                           text-white shadow-lg ${accent.shadowGlow}
                           transition-all duration-200 flex items-center justify-center gap-2
                           disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {isJoining ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Join Storyline
                  </>
                )}
              </button>
            )}
          </div>

          {/* Tabs - Custom styled with glassmorphism */}
          <div className="px-6">
            <div className="flex gap-1 p-1 bg-white/[0.03] rounded-xl border border-white/[0.06]">
              <button
                onClick={() => setActiveTab('details')}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200
                           flex items-center justify-center gap-2
                           ${activeTab === 'details' 
                             ? 'bg-white/[0.08] text-white shadow-sm' 
                             : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]'}`}
              >
                <Sparkles className="w-4 h-4" />
                Details
              </button>
              <button
                onClick={() => setActiveTab('reviews')}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200
                           flex items-center justify-center gap-2
                           ${activeTab === 'reviews' 
                             ? 'bg-white/[0.08] text-white shadow-sm' 
                             : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]'}`}
              >
                <MessageSquare className="w-4 h-4" />
                Reviews ({reviewCount})
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <ScrollArea className="h-[260px] px-6 py-4">
            {activeTab === 'details' && (
              <div className="space-y-5">
                {/* About Section */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <div className={`w-1 h-4 bg-gradient-to-b ${accent.from} ${accent.to} rounded-full`} />
                    About
                  </h4>
                  <p className="text-sm text-slate-400 leading-relaxed pl-3">
                    {displayServer.longDescription || displayServer.description || 'No description provided.'}
                  </p>
                </div>

                {/* Tags */}
                {displayServer.tags && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
                      <div className={`w-1 h-4 bg-gradient-to-b ${accent.toSubtle} to-blue-400 rounded-full`} />
                      Tags
                    </h4>
                    <div className="flex flex-wrap gap-2 pl-3">
                      {displayServer.tags.split(',').map((tag, index) => (
                        <span 
                          key={index} 
                          className="px-2.5 py-1 rounded-lg text-xs font-medium
                                     bg-white/[0.05] text-slate-300 border border-white/[0.08]"
                        >
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rules */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <div className="w-1 h-4 bg-gradient-to-b from-amber-500 to-orange-400 rounded-full" />
                    Community Guidelines
                  </h4>
                  <ul className="text-sm text-slate-400 space-y-2 pl-3">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded bg-white/[0.05] flex items-center justify-center text-xs text-slate-400 flex-shrink-0 mt-0.5">1</span>
                      Be respectful to all members
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded bg-white/[0.05] flex items-center justify-center text-xs text-slate-400 flex-shrink-0 mt-0.5">2</span>
                      Stay in character during roleplay sessions
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded bg-white/[0.05] flex items-center justify-center text-xs text-slate-400 flex-shrink-0 mt-0.5">3</span>
                      No god-modding or power playing
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded bg-white/[0.05] flex items-center justify-center text-xs text-slate-400 flex-shrink-0 mt-0.5">4</span>
                      Follow the community guidelines
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded bg-white/[0.05] flex items-center justify-center text-xs text-slate-400 flex-shrink-0 mt-0.5">5</span>
                      Have fun and be creative!
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-4">
                {/* Write Review */}
                {isJoined && (
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                    <h4 className="text-sm font-semibold text-slate-200 mb-3">Write a Review</h4>
                    <div className="flex items-center gap-1 mb-3">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setNewReview({ ...newReview, rating: star })}
                          className="p-1 hover:scale-110 transition-transform"
                        >
                          <Star
                            className={`w-5 h-5 transition-colors ${
                              star <= newReview.rating
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-white/[0.08] hover:text-amber-400/50'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="ml-2 text-sm text-slate-500">
                        {newReview.rating}/5
                      </span>
                    </div>
                    <Textarea
                      placeholder="Share your experience..."
                      value={newReview.content}
                      onChange={(e) => setNewReview({ ...newReview, content: e.target.value })}
                      rows={2}
                      className="bg-white/[0.03] border-white/[0.08] text-slate-200 placeholder:text-slate-600 resize-none text-sm"
                    />
                    <button
                      onClick={handleSubmitReview}
                      disabled={!newReview.content.trim() || isSubmittingReview}
                      className={`mt-3 px-4 py-2 rounded-lg text-sm font-medium
                                 ${accent.bgHeavy} ${accent.text} border ${accent.borderSubtle}
                                 hover:opacity-80 transition-colors
                                 disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isSubmittingReview ? 'Submitting...' : 'Submit Review'}
                    </button>
                  </div>
                )}

                {/* Reviews List */}
                {reviews.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-white/[0.05] flex items-center justify-center">
                      <MessageSquare className="w-6 h-6 text-slate-600" />
                    </div>
                    <p className="text-slate-500 text-sm">No reviews yet</p>
                    <p className="text-slate-600 text-xs mt-1">Be the first to share your experience!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reviews.map((review) => (
                      <div
                        key={review.id}
                        className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8 ring-1 ring-white/[0.08]">
                              <AvatarImage src={review.user.avatarUrl || undefined} />
                              <AvatarFallback className={`bg-gradient-to-br ${accent.avatarFrom} ${accent.avatarTo} text-xs`}>
                                {review.user.name?.charAt(0) || review.user.username?.charAt(0) || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm text-slate-200">
                                {review.user.name || review.user.username || 'Anonymous'}
                              </p>
                              <p className="text-xs text-slate-600">
                                {new Date(review.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-3.5 h-3.5 ${
                                  star <= review.rating
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-white/[0.06]'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed">{review.content}</p>
                        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.06]">
                          <button className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                            <ThumbsUp className="w-3.5 h-3.5" />
                            <span>Helpful</span>
                          </button>
                          <button className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                          <button className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors ml-auto">
                            <Flag className="w-3.5 h-3.5" />
                            <span>Report</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
