import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, MessageCircle, Share2, Bookmark } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export default function PostCard({ post, onLikeToggle }) {
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [isLiked, setIsLiked] = useState(post.is_liked || false)
  const [likeCount, setLikeCount] = useState(post.like_count || 0)
  const [isBookmarked, setIsBookmarked] = useState(post.is_bookmarked || false)
  const [likeLoading, setLikeLoading] = useState(false)

  const content = post.content || ''
  const isLongContent = content.length > 280
  const displayContent = expanded || !isLongContent 
    ? content 
    : content.slice(0, 280) + '...'

  const timeAgo = getTimeAgo(post.created_at)

  const handleLike = async () => {
    if (!user || likeLoading) return
    
    setLikeLoading(true)
    const newLikedState = !isLiked
    
    // Optimistic update
    setIsLiked(newLikedState)
    setLikeCount(prev => newLikedState ? prev + 1 : prev - 1)

    try {
      if (newLikedState) {
        const { error: likeError } = await supabase.from('post_likes').upsert({
          post_id: post.id,
          user_id: user.id,
        }, { onConflict: 'user_id, post_id' })

        if (likeError) throw likeError
        
        // Create notification for post owner (not if liking own post)
        if (post.author_id !== user.id) {
          const likerName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Someone'
          // Avoid duplicate notifications
          const { data: existingNotif } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', post.author_id)
            .eq('type', 'post_like')
            .eq('link', '/home')
            .ilike('title', `%liked your post%`)
            .gte('created_at', new Date(Date.now() - 60000).toISOString())
            .maybeSingle()

          if (!existingNotif) {
            await supabase.from('notifications').insert({
              user_id: post.author_id,
              type: 'post_like',
              title: `${likerName} liked your post`,
              message: post.content?.slice(0, 60) || 'Your post',
              link: '/home'
            })
          }
        }
      } else {
        await supabase.from('post_likes').delete().match({
          post_id: post.id,
          user_id: user.id,
        })
      }
      onLikeToggle?.(post.id, newLikedState)
    } catch (error) {
      // Revert on error
      setIsLiked(!newLikedState)
      setLikeCount(prev => newLikedState ? prev - 1 : prev + 1)
      console.error('Error toggling like:', error)
    } finally {
      setLikeLoading(false)
    }
  }

  const handleBookmark = async () => {
    if (!user) return
    
    const newBookmarkedState = !isBookmarked
    setIsBookmarked(newBookmarkedState)

    try {
      if (newBookmarkedState) {
        await supabase.from('bookmarks').insert({
          post_id: post.id,
          user_id: user.id,
        })
      } else {
        await supabase.from('bookmarks').delete().match({
          post_id: post.id,
          user_id: user.id,
        })
      }
    } catch (error) {
      setIsBookmarked(!newBookmarkedState)
      console.error('Error toggling bookmark:', error)
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Post by ${post.author?.full_name}`,
          text: content.slice(0, 100),
          url: window.location.origin + `/post/${post.id}`,
        })
      } catch (error) {
        // User cancelled or error
      }
    }
  }

  return (
    <article 
      className="p-5 transition-all duration-200 hover:border-white/[0.12]"
      style={{ 
        backgroundColor: '#131929',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '6px'
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <Link to={`/profile/${post.author?.id}`} className="flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-slate overflow-hidden">
            {post.author?.avatar_url ? (
              <img 
                src={post.author.avatar_url} 
                alt={post.author.full_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted text-sm font-medium">
                {post.author?.full_name?.charAt(0) || '?'}
              </div>
            )}
          </div>
        </Link>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2">
            <Link 
              to={`/profile/${post.author?.id}`}
              className="text-cream font-medium text-sm hover:underline"
            >
              {post.author?.full_name || 'Anonymous'}
            </Link>
            
            {post.subject && (
              <span 
                className="px-2 py-0.5 text-xs bg-accent/20 text-accent"
                style={{ borderRadius: '10px' }}
              >
                {post.subject}
              </span>
            )}
            
            <span className="text-muted text-xs">{timeAgo}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mb-3">
        <p className="text-cream/90 text-sm leading-relaxed whitespace-pre-wrap">
          {displayContent}
        </p>
        {isLongContent && !expanded && (
          <button 
            onClick={() => setExpanded(true)}
            className="text-accent text-sm mt-1 hover:underline"
          >
            Read more
          </button>
        )}
      </div>

      {/* Image Attachment */}
      {post.image_url && (
        <div className="mb-3 overflow-hidden" style={{ borderRadius: '4px' }}>
          <img 
            src={post.image_url} 
            alt="Post attachment"
            className="w-full max-h-96 object-cover"
          />
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-1">
          {/* Like */}
          <button 
            onClick={handleLike}
            disabled={likeLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors duration-200
                      ${isLiked 
                        ? 'text-[#E57373]' 
                        : 'text-muted hover:text-cream'
                      }`}
            style={{ borderRadius: '4px' }}
          >
            <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
            <span className="text-xs">{likeCount > 0 ? likeCount : ''}</span>
          </button>

          {/* Comment */}
          <Link 
            to={`/post/${post.id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-muted hover:text-cream 
                     transition-colors duration-200"
            style={{ borderRadius: '4px' }}
          >
            <MessageCircle size={18} />
            <span className="text-xs">{post.comment_count > 0 ? post.comment_count : ''}</span>
          </Link>

          {/* Share */}
          <button 
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 text-muted hover:text-cream 
                     transition-colors duration-200"
            style={{ borderRadius: '4px' }}
          >
            <Share2 size={18} />
          </button>
        </div>

        {/* Bookmark */}
        <button 
          onClick={handleBookmark}
          className={`p-1.5 transition-colors duration-200
                    ${isBookmarked 
                      ? 'text-accent' 
                      : 'text-muted hover:text-cream'
                    }`}
        >
          <Bookmark size={18} fill={isBookmarked ? 'currentColor' : 'none'} />
        </button>
      </div>
    </article>
  )
}

function getTimeAgo(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now - date) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
