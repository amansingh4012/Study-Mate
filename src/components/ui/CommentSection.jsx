import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { X, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const INITIAL_LIMIT = 3

export default function CommentSection({ postId, postAuthorId }) {
  const { user } = useAuth()
  const [comments, setComments] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef(null)
  const [userProfile, setUserProfile] = useState(null)

  // Fetch current user's profile for avatar
  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('id', user.id)
      .single()
      .then(({ data }) => { if (data) setUserProfile(data) })
  }, [user?.id])

  // Fetch comments
  useEffect(() => {
    fetchComments()
  }, [postId, showAll])

  const fetchComments = async () => {
    setLoading(true)
    try {
      // Get total count
      const { count } = await supabase
        .from('comments')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', postId)

      setTotalCount(count || 0)

      // Fetch comments with author
      let query = supabase
        .from('comments')
        .select('*, author:profiles!comments_user_id_fkey(id, full_name, avatar_url)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })

      if (!showAll) {
        query = query.limit(INITIAL_LIMIT)
      }

      const { data, error } = await query
      if (error) throw error
      setComments(data || [])
    } catch (err) {
      console.error('Error fetching comments:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    const trimmed = inputValue.trim()
    if (!trimmed || !user || submitting) return

    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({ post_id: postId, user_id: user.id, content: trimmed })
        .select('*, author:profiles!comments_user_id_fkey(id, full_name, avatar_url)')
        .single()

      if (error) throw error

      setComments(prev => [...prev, data])
      setTotalCount(prev => prev + 1)
      setInputValue('')

      // Notify post author (skip if commenting on own post)
      if (postAuthorId && postAuthorId !== user.id) {
        const commenterName = userProfile?.full_name || user.email?.split('@')[0] || 'Someone'
        await supabase.from('notifications').insert({
          user_id: postAuthorId,
          type: 'post_like', // reuse type since schema doesn't have 'comment'
          title: `${commenterName} commented on your post`,
          message: trimmed.slice(0, 60),
          link: '/home',
        }).then(() => {}) // fire-and-forget
      }
    } catch (err) {
      console.error('Error posting comment:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (commentId) => {
    try {
      await supabase.from('comments').delete().eq('id', commentId)
      setComments(prev => prev.filter(c => c.id !== commentId))
      setTotalCount(prev => prev - 1)
    } catch (err) {
      console.error('Error deleting comment:', err)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="pt-3 border-t border-white/[0.06]">
      {/* Comments list */}
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 size={18} className="animate-spin text-muted" />
        </div>
      ) : (
        <>
          {comments.length === 0 && (
            <p className="text-muted text-xs text-center py-3">No comments yet. Be the first!</p>
          )}

          <div className="space-y-3">
            {comments.map(comment => (
              <div key={comment.id} className="flex gap-2.5 group">
                {/* Avatar */}
                <Link to={`/profile/${comment.author?.id}`} className="flex-shrink-0">
                  <div className="w-7 h-7 rounded-full bg-slate overflow-hidden">
                    {comment.author?.avatar_url ? (
                      <img
                        src={comment.author.avatar_url}
                        alt={comment.author.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted text-[10px] font-medium">
                        {comment.author?.full_name?.charAt(0) || '?'}
                      </div>
                    )}
                  </div>
                </Link>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <Link
                      to={`/profile/${comment.author?.id}`}
                      className="text-cream text-xs font-medium hover:underline"
                    >
                      {comment.author?.full_name || 'Anonymous'}
                    </Link>
                    <span className="text-muted text-[10px]">{getTimeAgo(comment.created_at)}</span>
                  </div>
                  <p className="text-cream/80 text-xs leading-relaxed whitespace-pre-wrap mt-0.5">
                    {comment.content}
                  </p>
                </div>

                {/* Delete (own comments only) */}
                {user && comment.user_id === user.id && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 text-muted 
                             hover:text-red-400 transition-all duration-150"
                    title="Delete comment"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* View all / collapse */}
          {!showAll && totalCount > INITIAL_LIMIT && (
            <button
              onClick={() => setShowAll(true)}
              className="text-accent text-xs mt-3 hover:underline"
            >
              View all {totalCount} comments
            </button>
          )}
          {showAll && totalCount > INITIAL_LIMIT && (
            <button
              onClick={() => setShowAll(false)}
              className="text-muted text-xs mt-3 hover:text-cream transition-colors"
            >
              Show less
            </button>
          )}
        </>
      )}

      {/* Input */}
      {user && (
        <div className="flex gap-2.5 mt-3 pt-3 border-t border-white/[0.04]">
          <div className="w-7 h-7 rounded-full bg-slate overflow-hidden flex-shrink-0">
            {userProfile?.avatar_url ? (
              <img
                src={userProfile.avatar_url}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted text-[10px] font-medium">
                {userProfile?.full_name?.charAt(0) || '?'}
              </div>
            )}
          </div>
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write a comment..."
              rows={1}
              className="w-full bg-white/[0.04] text-cream text-xs placeholder-muted/60
                       px-3 py-2 resize-none outline-none focus:ring-1 focus:ring-accent/40 
                       transition-all"
              style={{ borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}
              disabled={submitting}
            />
            {submitting && (
              <Loader2 size={14} className="absolute right-2 top-2 animate-spin text-muted" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function getTimeAgo(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now - date) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
