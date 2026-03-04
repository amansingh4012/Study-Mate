import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { RefreshCw, Radio, MessageSquare, ChevronRight, Flame } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import MateCard from '../components/ui/MateCard'
import RoomCard from '../components/ui/RoomCard'
import PostCard from '../components/ui/PostCard'
import {
  RoomCardSkeleton,
  MateCardSkeleton,
  SessionCardSkeleton,
  PostCardSkeleton,
} from '../components/ui/Skeletons'

const POSTS_PER_PAGE = 10

export default function Discover() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [userProfile, setUserProfile] = useState(null)

  // Trending rooms
  const [trendingRooms, setTrendingRooms] = useState([])
  const [loadingRooms, setLoadingRooms] = useState(true)

  // Suggested mates
  const [suggestedMates, setSuggestedMates] = useState([])
  const [loadingMates, setLoadingMates] = useState(true)
  const [refreshingMates, setRefreshingMates] = useState(false)

  // Live sessions
  const [liveSessions, setLiveSessions] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(true)

  // Subject posts
  const [posts, setPosts] = useState([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [loadingMorePosts, setLoadingMorePosts] = useState(false)
  const [hasMorePosts, setHasMorePosts] = useState(true)
  const postsOffsetRef = useRef(0)

  // Shared: IDs of users already connected (used by mates + posts)
  const [connectedIds, setConnectedIds] = useState(new Set())

  // ─── Fetch user profile ───
  useEffect(() => {
    if (!user) return
    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (data) setUserProfile(data)
    }
    fetchProfile()
  }, [user?.id])

  // ─── Once profile is ready, compute connections then fetch everything ───
  useEffect(() => {
    if (!userProfile) return
    const init = async () => {
      // Build the set of connected / pending user IDs (shared by mates + posts)
      const ids = new Set([user.id])

      const [{ data: conns }, { data: reqs }] = await Promise.all([
        supabase
          .from('connections')
          .select('user1_id, user2_id')
          .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`),
        supabase
          .from('mate_requests')
          .select('from_user, to_user')
          .or(`from_user.eq.${user.id},to_user.eq.${user.id}`)
          .eq('status', 'pending'),
      ])

      ;(conns || []).forEach(c => { ids.add(c.user1_id); ids.add(c.user2_id) })
      ;(reqs || []).forEach(r => { ids.add(r.from_user); ids.add(r.to_user) })

      setConnectedIds(ids)

      // Now fire all section fetches
      fetchTrendingRooms()
      fetchSuggestedMates(false, ids)
      fetchLiveSessions()
      fetchSubjectPosts(true, ids)
    }
    init()
  }, [userProfile?.id])

  // ═══════════════════════════════════════════
  // 1. TRENDING ROOMS — most messages in last 24h
  // ═══════════════════════════════════════════
  const fetchTrendingRooms = async () => {
    setLoadingRooms(true)
    try {
      // Get message counts per room in last 24h
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      const { data: messageCounts } = await supabase
        .from('room_messages')
        .select('room_id')
        .gte('created_at', since)

      if (!messageCounts || messageCounts.length === 0) {
        // Fallback: just show rooms with most members
        const { data: rooms } = await supabase
          .from('rooms')
          .select('*')
          .order('member_count', { ascending: false })
          .limit(5)
        setTrendingRooms((rooms || []).map(r => ({ ...r, messages_today: 0 })))
        setLoadingRooms(false)
        return
      }

      // Count messages per room
      const countMap = {}
      messageCounts.forEach(({ room_id }) => {
        countMap[room_id] = (countMap[room_id] || 0) + 1
      })

      // Sort by count, take top 5
      const topRoomIds = Object.entries(countMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id]) => id)

      const { data: rooms } = await supabase
        .from('rooms')
        .select('*')
        .in('id', topRoomIds)

      // Attach message count & sort
      const enriched = (rooms || [])
        .map(r => ({ ...r, messages_today: countMap[r.id] || 0 }))
        .sort((a, b) => b.messages_today - a.messages_today)

      setTrendingRooms(enriched)
    } catch (err) {
      console.error('Error fetching trending rooms:', err)
    } finally {
      setLoadingRooms(false)
    }
  }

  // ═══════════════════════════════════════════
  // 2. STUDY MATES YOU MIGHT KNOW
  // ═══════════════════════════════════════════
  const fetchSuggestedMates = useCallback(async (isRefresh = false, idsOverride) => {
    if (isRefresh) setRefreshingMates(true)
    else setLoadingMates(true)

    try {
      const mySubjects = userProfile?.subjects || []
      const excludeSet = idsOverride || connectedIds
      const excludeIds = [...excludeSet]

      // Fetch candidate profiles not in excluded set
      const { data: candidates } = await supabase
        .from('profiles')
        .select('*')
        .not('id', 'in', `(${excludeIds.join(',')})`)
        .not('full_name', 'is', null)
        .limit(50)

      if (!candidates || candidates.length === 0) {
        setSuggestedMates([])
        return
      }

      // Check which candidates have posted in last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const candidateIds = candidates.map(c => c.id)
      const { data: recentPosts } = await supabase
        .from('posts')
        .select('author_id')
        .in('author_id', candidateIds)
        .gte('created_at', sevenDaysAgo)
      const recentlyActiveIds = new Set((recentPosts || []).map(p => p.author_id))

      // Score: +2 per shared subject, +1 if posted recently
      const scored = candidates.map(c => {
        let score = 0
        const theirSubjects = c.subjects || []
        mySubjects.forEach(s => {
          if (theirSubjects.includes(s)) score += 2
        })
        if (recentlyActiveIds.has(c.id)) score += 1
        return { ...c, _score: score }
      })

      // Filter to at least 1 shared subject (score >= 2), sort desc with randomness
      const filtered = scored
        .filter(c => c._score >= 2)
        .sort((a, b) => b._score - a._score || Math.random() - 0.5)

      // If not enough, pad from the remaining pool
      let result = filtered.slice(0, 6)
      if (result.length < 6) {
        const usedIds = new Set(result.map(r => r.id))
        const rest = scored
          .filter(c => !usedIds.has(c.id))
          .sort(() => Math.random() - 0.5)
        result = [...result, ...rest].slice(0, 6)
      }

      setSuggestedMates(result)
    } catch (err) {
      console.error('Error fetching suggested mates:', err)
    } finally {
      setLoadingMates(false)
      setRefreshingMates(false)
    }
  }, [user?.id, userProfile?.subjects, connectedIds])

  // ═══════════════════════════════════════════
  // 3. ACTIVE SESSIONS RIGHT NOW
  // ═══════════════════════════════════════════
  const fetchLiveSessions = async () => {
    setLoadingSessions(true)
    try {
      const { data } = await supabase
        .from('sessions')
        .select(`
          *,
          host:profiles!sessions_host_id_fkey(id, full_name, avatar_url)
        `)
        .eq('status', 'live')
        .order('started_at', { ascending: false })
        .limit(6)

      setLiveSessions(data || [])
    } catch (err) {
      console.error('Error fetching live sessions:', err)
    } finally {
      setLoadingSessions(false)
    }
  }

  // ═══════════════════════════════════════════
  // 4. POSTS FROM YOUR SUBJECTS
  // ═══════════════════════════════════════════
  const fetchSubjectPosts = useCallback(async (reset = false, idsOverride) => {
    if (!userProfile) return
    const mySubjects = userProfile.subjects || []
    const excludeSet = idsOverride || connectedIds

    if (reset) {
      setLoadingPosts(true)
      setPosts([])
      postsOffsetRef.current = 0
    } else {
      setLoadingMorePosts(true)
    }

    try {
      const offset = reset ? 0 : postsOffsetRef.current

      // Exclude posts from the user AND people they already follow
      const excludeAuthorIds = [...excludeSet]

      let query = supabase
        .from('posts')
        .select(`
          *,
          author:profiles!posts_author_id_fkey(id, full_name, avatar_url),
          like_count:post_likes(count),
          comment_count:comments(count)
        `)
        .not('author_id', 'in', `(${excludeAuthorIds.join(',')})`)
        .order('created_at', { ascending: false })
        .range(offset, offset + POSTS_PER_PAGE - 1)

      // Filter to user's subjects if they have any
      if (mySubjects.length > 0) {
        query = query.in('subject', mySubjects)
      }

      const { data: rawPosts, error } = await query
      if (error) throw error

      const postsList = (rawPosts || []).map(p => ({
        ...p,
        author_name: p.author?.full_name,
        author_avatar: p.author?.avatar_url,
        like_count: p.like_count?.[0]?.count || 0,
        comment_count: p.comment_count?.[0]?.count || 0,
      }))

      // Batch check likes & bookmarks
      if (postsList.length > 0) {
        const postIds = postsList.map(p => p.id)
        const [{ data: myLikes }, { data: myBookmarks }] = await Promise.all([
          supabase.from('post_likes').select('post_id').eq('user_id', user.id).in('post_id', postIds),
          supabase.from('bookmarks').select('post_id').eq('user_id', user.id).in('post_id', postIds),
        ])
        const likedSet = new Set((myLikes || []).map(l => l.post_id))
        const bookmarkedSet = new Set((myBookmarks || []).map(b => b.post_id))
        postsList.forEach(p => {
          p.is_liked = likedSet.has(p.id)
          p.is_bookmarked = bookmarkedSet.has(p.id)
        })
      }

      if (reset) {
        setPosts(postsList)
      } else {
        setPosts(prev => [...prev, ...postsList])
      }
      postsOffsetRef.current = offset + postsList.length
      setHasMorePosts(postsList.length === POSTS_PER_PAGE)
    } catch (err) {
      console.error('Error fetching subject posts:', err)
    } finally {
      setLoadingPosts(false)
      setLoadingMorePosts(false)
    }
  }, [user?.id, userProfile, connectedIds])

  // ─── Section header component ───
  const SectionHeader = ({ icon: Icon, title, action }) => (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={18} className="text-accent" />}
        <h2 className="font-heading text-lg text-cream font-bold uppercase tracking-wide">
          {title}
        </h2>
      </div>
      {action}
    </div>
  )

  return (
    <div className="space-y-10">
      {/* Page title */}
      <div>
        <h1 className="font-heading text-3xl sm:text-4xl text-cream font-bold mb-1">
          Discover
        </h1>
        <p className="text-muted text-sm">Find trending rooms, new study mates, and fresh content.</p>
      </div>

      {/* ═══════════════════════════════════════
          1. TRENDING ROOMS
         ═══════════════════════════════════════ */}
      <section>
        <SectionHeader icon={Flame} title="Trending Rooms" />

        {loadingRooms ? (
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="min-w-[280px] max-w-[300px] flex-shrink-0">
                <RoomCardSkeleton />
              </div>
            ))}
          </div>
        ) : trendingRooms.length === 0 ? (
          <p className="text-muted text-sm">No trending rooms yet. Start chatting!</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {trendingRooms.map(room => (
              <Link
                key={room.id}
                to={`/rooms/${room.id}`}
                className="min-w-[280px] max-w-[300px] flex-shrink-0 block group"
              >
                <div
                  className="p-5 h-full transition-all duration-200 group-hover:border-accent/30"
                  style={{
                    backgroundColor: '#131929',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '8px',
                  }}
                >
                  <h3 className="font-heading text-cream font-bold text-lg mb-1 truncate">
                    {room.name}
                  </h3>
                  {room.description && (
                    <p className="text-muted text-sm line-clamp-2 mb-3">{room.description}</p>
                  )}
                  {room.category && (
                    <span
                      className="inline-block px-2.5 py-1 text-xs border border-accent/40 text-accent mb-3"
                      style={{ borderRadius: '10px' }}
                    >
                      {room.category}
                    </span>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted mt-auto">
                    <span className="flex items-center gap-1">
                      <MessageSquare size={12} />
                      <span className="text-accent font-medium">
                        {room.messages_today} messages today
                      </span>
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════
          2. STUDY MATES YOU MIGHT KNOW
         ═══════════════════════════════════════ */}
      <section>
        <SectionHeader
          title="Study Mates You Might Know"
          action={
            <button
              onClick={() => fetchSuggestedMates(true)}
              disabled={refreshingMates}
              className="flex items-center gap-1.5 text-sm text-muted hover:text-accent 
                       transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshingMates ? 'animate-spin' : ''} />
              Refresh
            </button>
          }
        />

        {loadingMates ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <MateCardSkeleton key={i} />
            ))}
          </div>
        ) : suggestedMates.length === 0 ? (
          <div
            className="p-6 text-center"
            style={{
              backgroundColor: '#131929',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '6px',
            }}
          >
            <p className="text-muted text-sm">
              No new suggestions right now. Try updating your subjects to get better matches!
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {suggestedMates.map(mate => (
              <MateCard
                key={mate.id}
                mate={mate}
                connectionStatus={null}
                onSendNote={() => {}}
              />
            ))}
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════
          3. ACTIVE SESSIONS RIGHT NOW
         ═══════════════════════════════════════ */}
      <section>
        <SectionHeader icon={Radio} title="Active Sessions Right Now" />

        {loadingSessions ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <SessionCardSkeleton key={i} />
            ))}
          </div>
        ) : liveSessions.length === 0 ? (
          <div
            className="p-8 text-center"
            style={{
              backgroundColor: '#131929',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '6px',
            }}
          >
            <Radio size={32} className="mx-auto text-slate mb-3" />
            <p className="text-muted text-sm mb-4">
              No live sessions right now. Check back later or start your own.
            </p>
            <Link
              to="/sessions"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-navy 
                       font-medium text-sm hover:opacity-90 transition-opacity"
              style={{ borderRadius: '4px' }}
            >
              <Radio size={16} />
              Go Live
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {liveSessions.map(session => (
              <Link
                key={session.id}
                to={`/sessions/${session.id}`}
                className="block group"
              >
                <div
                  className="p-5 transition-all duration-200 group-hover:border-accent/30"
                  style={{
                    backgroundColor: '#131929',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '6px',
                  }}
                >
                  {/* Host */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-slate overflow-hidden flex-shrink-0">
                      {session.host?.avatar_url ? (
                        <img src={session.host.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted text-xs">
                          {(session.host?.full_name || 'U').charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-cream text-sm font-medium truncate">
                        {session.host?.full_name || 'User'}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-red-400 text-xs font-medium">LIVE</span>
                      </div>
                    </div>
                  </div>
                  {/* Title & subject */}
                  <h3 className="font-heading text-cream font-semibold mb-1 truncate">
                    {session.title}
                  </h3>
                  {session.subject && (
                    <span
                      className="inline-block px-2 py-0.5 text-[11px] border border-accent/40 text-accent"
                      style={{ borderRadius: '10px' }}
                    >
                      {session.subject}
                    </span>
                  )}
                  {session.viewer_count > 0 && (
                    <p className="text-muted text-xs mt-2">
                      {session.viewer_count} watching
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════
          4. POSTS FROM YOUR SUBJECTS
         ═══════════════════════════════════════ */}
      <section>
        <SectionHeader
          title="Posts From Your Subjects"
          action={
            userProfile?.subjects?.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {userProfile.subjects.slice(0, 3).map(s => (
                  <span
                    key={s}
                    className="text-[11px] px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: 'rgba(168,255,62,0.1)', color: '#A8FF3E' }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            )
          }
        />

        {loadingPosts ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <PostCardSkeleton key={i} />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div
            className="p-8 text-center"
            style={{
              backgroundColor: '#131929',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '6px',
            }}
          >
            <p className="text-muted text-sm">
              No posts matching your subjects yet. Explore other topics or create your own post!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map(post => (
              <PostCard key={post.id} post={post} />
            ))}

            {/* Load more */}
            {hasMorePosts && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => fetchSubjectPosts(false)}
                  disabled={loadingMorePosts}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm text-cream 
                           bg-white/[0.04] border border-white/[0.06] rounded-lg
                           hover:bg-white/[0.08] transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingMorePosts ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      Load more
                      <ChevronRight size={14} />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
