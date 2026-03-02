import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Users, Radio, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import PostCard from '../components/ui/PostCard'
import CreatePost from '../components/ui/CreatePost'
import { PostCardSkeleton } from '../components/ui/Skeletons'
import { HomeFeedEmpty } from '../components/ui/EmptyState'
import ErrorBoundary from '../components/layout/ErrorBoundary'

const POSTS_PER_PAGE = 10

export default function Home() {
  const { user } = useAuth()
  
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [selectedSubject, setSelectedSubject] = useState(null)
  
  const [userProfile, setUserProfile] = useState(null)
  const [activeRooms, setActiveRooms] = useState([])
  const [suggestedUsers, setSuggestedUsers] = useState([])
  const [trendingTopics, setTrendingTopics] = useState([])

  // Fetch user profile + sync any pending onboarding data
  useEffect(() => {
    if (!user) return
    
    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (data) {
        // Check for pending onboarding data that wasn't saved
        const pendingRaw = localStorage.getItem('pendingOnboardingData')
        if (pendingRaw) {
          try {
            const pending = JSON.parse(pendingRaw)
            const profileIsEmpty = !data.bio && (!data.subjects || data.subjects.length === 0)
            if (profileIsEmpty && pending.bio) {
              
              // If there's a pending avatar base64, upload it first
              if (pending._pendingAvatarBase64) {
                try {
                  const base64 = pending._pendingAvatarBase64
                  const mimeMatch = base64.match(/data:([^;]+);/)
                  const mime = mimeMatch ? mimeMatch[1] : 'image/png'
                  const ext = mime.split('/')[1] || 'png'
                  const byteString = atob(base64.split(',')[1])
                  const ab = new ArrayBuffer(byteString.length)
                  const ia = new Uint8Array(ab)
                  for (let i = 0; i < byteString.length; i++) {
                    ia[i] = byteString.charCodeAt(i)
                  }
                  const blob = new Blob([ab], { type: mime })
                  
                  const fileName = `${user.id}-${Date.now()}.${ext}`
                  const { error: upErr } = await supabase.storage
                    .from('avatars')
                    .upload(fileName, blob, { upsert: true })
                  
                  if (!upErr) {
                    const { data: urlData } = supabase.storage
                      .from('avatars')
                      .getPublicUrl(fileName)
                    pending.avatar_url = urlData.publicUrl
                  } else {
                    console.error('Avatar upload on sync failed:', upErr.message)
                  }
                } catch (avatarErr) {
                  console.error('Avatar base64 processing failed:', avatarErr)
                }
                delete pending._pendingAvatarBase64
              }
              
              const { data: synced, error: syncErr } = await supabase
                .from('profiles')
                .update(pending)
                .eq('id', user.id)
                .select()
                .maybeSingle()
              
              if (!syncErr && synced) {
                console.log('Pending onboarding data synced on Home load')
                setUserProfile(synced)
                localStorage.removeItem('pendingOnboardingData')
                // Also sync to auth metadata
                await supabase.auth.updateUser({
                  data: {
                    full_name: pending.full_name,
                    avatar_url: pending.avatar_url,
                    university: pending.university,
                    bio: pending.bio,
                    subjects: pending.subjects,
                    study_style: pending.study_style,
                  }
                })
                return
              }
            } else {
              localStorage.removeItem('pendingOnboardingData')
            }
          } catch (e) {
            localStorage.removeItem('pendingOnboardingData')
          }
        }
        
        setUserProfile(data)
      }
    }
    
    fetchProfile()
  }, [user?.id])

  // Track offset via ref to avoid dependency issues
  const postsOffsetRef = useRef(0)

  // Fetch posts — batched like/bookmark check instead of N+1
  const fetchPosts = useCallback(async (reset = false) => {
    if (!user) return
    
    if (reset) {
      setLoading(true)
      setPosts([])
      postsOffsetRef.current = 0
    } else {
      setLoadingMore(true)
    }

    try {
      const offset = reset ? 0 : postsOffsetRef.current
      let query = supabase
        .from('posts')
        .select(`
          *,
          author:profiles!posts_author_id_fkey(id, full_name, avatar_url),
          like_count:post_likes(count),
          comment_count:comments(count)
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + POSTS_PER_PAGE - 1)

      if (selectedSubject) {
        query = query.eq('subject', selectedSubject)
      }

      const { data, error } = await query

      if (error) throw error

      const fetchedPosts = data || []

      // Batch check likes & bookmarks in 2 queries instead of 2×N
      const postIds = fetchedPosts.map(p => p.id)
      let likedIds = new Set()
      let bookmarkedIds = new Set()

      if (postIds.length > 0) {
        const [likesRes, bookmarksRes] = await Promise.all([
          supabase
            .from('post_likes')
            .select('post_id')
            .eq('user_id', user.id)
            .in('post_id', postIds),
          supabase
            .from('bookmarks')
            .select('post_id')
            .eq('user_id', user.id)
            .in('post_id', postIds)
        ])

        likedIds = new Set((likesRes.data || []).map(l => l.post_id))
        bookmarkedIds = new Set((bookmarksRes.data || []).map(b => b.post_id))
      }

      const postsWithLikes = fetchedPosts.map(post => ({
        ...post,
        like_count: post.like_count?.[0]?.count || 0,
        comment_count: post.comment_count?.[0]?.count || 0,
        is_liked: likedIds.has(post.id),
        is_bookmarked: bookmarkedIds.has(post.id),
      }))

      postsOffsetRef.current = offset + postsWithLikes.length

      if (reset) {
        setPosts(postsWithLikes)
      } else {
        setPosts(prev => [...prev, ...postsWithLikes])
      }
      
      setHasMore(postsWithLikes.length === POSTS_PER_PAGE)
    } catch (error) {
      console.error('Error fetching posts:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [user?.id, selectedSubject])

  // Initial fetch and on filter change
  useEffect(() => {
    if (!user) return
    fetchPosts(true)
  }, [selectedSubject, user?.id])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('posts-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        async (payload) => {
          // Fetch the complete post with author
          const { data } = await supabase
            .from('posts')
            .select(`
              *,
              author:profiles!posts_author_id_fkey(id, full_name, avatar_url)
            `)
            .eq('id', payload.new.id)
            .single()

          if (data) {
            setPosts(prev => [{
              ...data,
              like_count: 0,
              comment_count: 0,
              is_liked: false,
              is_bookmarked: false,
            }, ...prev])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Fetch sidebar data
  useEffect(() => {
    if (!user) return
    fetchActiveRooms()
    fetchSuggestedUsers()
    fetchTrendingTopics()
  }, [user?.id])

  const fetchActiveRooms = async () => {
    try {
      const { data } = await supabase
        .from('rooms')
        .select('id, name, subject, room_members(count)')
        .eq('is_active', true)
        .limit(3)
      
      if (data) {
        const withCounts = data.map(r => ({
          ...r,
          member_count: r.room_members?.[0]?.count || 0,
        }))
        // Sort by member count descending
        withCounts.sort((a, b) => b.member_count - a.member_count)
        setActiveRooms(withCounts)
      }
    } catch (err) {
      console.warn('Failed to fetch active rooms:', err.message)
    }
  }

  const fetchSuggestedUsers = async () => {
    if (!user || !userProfile?.subjects?.length) return
    
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url, subjects')
        .neq('id', user.id)
        .limit(3)
      
      if (data) setSuggestedUsers(data)
    } catch (err) {
      console.warn('Failed to fetch suggested users:', err.message)
    }
  }

  const fetchTrendingTopics = async () => {
    try {
      const { data } = await supabase
        .from('posts')
        .select('subject')
        .not('subject', 'is', null)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

      if (data) {
        const counts = data.reduce((acc, post) => {
          acc[post.subject] = (acc[post.subject] || 0) + 1
          return acc
        }, {})
        
        const sorted = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([subject, count]) => ({ subject, count }))
        
        setTrendingTopics(sorted)
      }
    } catch (err) {
      console.warn('Failed to fetch trending topics:', err.message)
    }
  }

  const handlePostCreated = (newPost) => {
    setPosts(prev => [newPost, ...prev])
  }

  const handleSubjectFilter = (subject) => {
    setSelectedSubject(selectedSubject === subject ? null : subject)
  }

  const userSubjects = userProfile?.subjects || []

  return (
    <div className="fade-in">
      <div className="flex gap-4 lg:gap-6">
        {/* Left Sidebar - Desktop only */}
        <aside className="hidden lg:block w-[280px] flex-shrink-0 space-y-6">
          {/* Your Subjects */}
          <div 
            className="p-4"
            style={{ 
              backgroundColor: '#131929',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '6px'
            }}
          >
            <h3 className="font-heading text-sm text-cream font-semibold mb-3">
              Your Subjects
            </h3>
            {userSubjects.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {userSubjects.map((subject) => (
                  <button
                    key={subject}
                    onClick={() => handleSubjectFilter(subject)}
                    className={`px-3 py-1.5 text-xs transition-all duration-200
                             ${selectedSubject === subject
                               ? 'bg-accent text-navy'
                               : 'bg-slate/30 text-muted hover:text-cream'
                             }`}
                    style={{ borderRadius: '12px' }}
                  >
                    {subject}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-muted text-xs">
                No subjects selected yet.{' '}
                <Link to="/profile" className="text-accent hover:underline">
                  Add some
                </Link>
              </p>
            )}
            
            {selectedSubject && (
              <button
                onClick={() => setSelectedSubject(null)}
                className="mt-3 text-xs text-muted hover:text-cream transition-colors"
              >
                Clear filter
              </button>
            )}
          </div>

          {/* Active Rooms */}
          <div 
            className="p-4"
            style={{ 
              backgroundColor: '#131929',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '6px'
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading text-sm text-cream font-semibold">
                Active Rooms
              </h3>
              <Link to="/rooms" className="text-accent text-xs hover:underline">
                See all
              </Link>
            </div>
            
            {activeRooms.length > 0 ? (
              <div className="space-y-2">
                {activeRooms.map((room) => (
                  <Link
                    key={room.id}
                    to={`/rooms/${room.id}`}
                    className="block p-3 bg-slate/20 hover:bg-slate/30 transition-colors duration-200"
                    style={{ borderRadius: '4px' }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Radio size={12} className="text-accent" />
                      <span className="text-cream text-xs font-medium truncate">
                        {room.name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted text-[10px]">{room.subject}</span>
                      <span className="text-muted text-[10px]">
                        {room.member_count} members
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted text-xs">No active rooms right now.</p>
            )}
          </div>
        </aside>

        {/* Main Feed */}
        <main className="flex-1 min-w-0 space-y-4">
          {/* Create Post */}
          <CreatePost 
            onPostCreated={handlePostCreated} 
            userSubjects={userSubjects}
          />

          {/* Filter indicator */}
          {selectedSubject && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted">Showing posts about:</span>
              <span className="px-2 py-1 bg-accent/20 text-accent text-xs rounded">
                {selectedSubject}
              </span>
            </div>
          )}

          {/* Posts */}
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <PostCardSkeleton key={i} />
              ))}
            </div>
          ) : posts.length > 0 ? (
            <>
              <div className="space-y-4">
                {posts.map((post) => (
                  <PostCard 
                    key={post.id} 
                    post={post}
                    onLikeToggle={(postId, liked) => {
                      setPosts(prev => prev.map(p => 
                        p.id === postId 
                          ? { ...p, is_liked: liked, like_count: liked ? p.like_count + 1 : p.like_count - 1 }
                          : p
                      ))
                    }}
                  />
                ))}
              </div>

              {/* Load More */}
              {hasMore && (
                <div className="flex justify-center pt-4">
                  <button
                    onClick={() => fetchPosts(false)}
                    disabled={loadingMore}
                    className="px-6 py-2 bg-transparent border border-slate/50 text-muted text-sm
                             hover:border-cream/30 hover:text-cream transition-all duration-200
                             disabled:opacity-50 flex items-center gap-2"
                    style={{ borderRadius: '4px' }}
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load more'
                    )}
                  </button>
                </div>
              )}
            </>
          ) : (
            <HomeFeedEmpty />
          )}
        </main>

        {/* Right Sidebar - Desktop only */}
        <aside className="hidden xl:block w-[260px] flex-shrink-0 space-y-6">
          {/* People You Might Know */}
          <div 
            className="p-4"
            style={{ 
              backgroundColor: '#131929',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '6px'
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading text-sm text-cream font-semibold">
                People You Might Know
              </h3>
              <Link to="/find-mate" className="text-accent text-xs hover:underline">
                See all
              </Link>
            </div>
            
            {suggestedUsers.length > 0 ? (
              <div className="space-y-3">
                {suggestedUsers.map((profile) => {
                  const displayName = profile.full_name?.trim() || (profile.email ? profile.email.split('@')[0] : 'User')
                  return (
                  <Link
                    key={profile.id}
                    to={`/profile/${profile.id}`}
                    className="flex items-center gap-3 p-2 hover:bg-slate/20 transition-colors duration-200"
                    style={{ borderRadius: '4px' }}
                  >
                    <div className="w-10 h-10 rounded-full bg-slate overflow-hidden flex-shrink-0">
                      {profile.avatar_url ? (
                        <img 
                          src={profile.avatar_url} 
                          alt={displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted text-sm">
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-cream text-sm font-medium truncate">
                        {displayName}
                      </p>
                      {profile.subjects?.length > 0 && (
                        <p className="text-muted text-xs truncate">
                          {profile.subjects.slice(0, 2).join(', ')}
                        </p>
                      )}
                    </div>
                  </Link>
                )})}
              </div>
            ) : (
              <p className="text-muted text-xs">
                Complete your profile to get suggestions.
              </p>
            )}
          </div>

          {/* Trending Topics */}
          <div 
            className="p-4"
            style={{ 
              backgroundColor: '#131929',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '6px'
            }}
          >
            <h3 className="font-heading text-sm text-cream font-semibold mb-3">
              Trending Topics
            </h3>
            
            {trendingTopics.length > 0 ? (
              <div className="space-y-2">
                {trendingTopics.map(({ subject, count }) => (
                  <button
                    key={subject}
                    onClick={() => handleSubjectFilter(subject)}
                    className="w-full flex items-center justify-between p-2 hover:bg-slate/20 
                             transition-colors duration-200 text-left"
                    style={{ borderRadius: '4px' }}
                  >
                    <span className="text-cream text-sm">{subject}</span>
                    <span className="text-muted text-xs">{count} posts</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-muted text-xs">No trending topics yet.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
