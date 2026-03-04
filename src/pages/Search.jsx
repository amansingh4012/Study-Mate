import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search as SearchIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import MateCard from '../components/ui/MateCard'
import RoomCard from '../components/ui/RoomCard'
import PostCard from '../components/ui/PostCard'
import { MateCardSkeleton, RoomCardSkeleton, PostCardSkeleton } from '../components/ui/Skeletons'

const TABS = ['People', 'Rooms', 'Posts']
const PAGE_SIZE = 10

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState('People')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [inputValue, setInputValue] = useState(query)
  const debounceRef = useRef(null)

  // Sync input when URL query changes
  useEffect(() => {
    setInputValue(searchParams.get('q') || '')
  }, [searchParams])

  // Fetch results when query, tab, or page changes
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    fetchResults()
  }, [query, activeTab, page])

  // Reset page when tab or query changes
  useEffect(() => {
    setPage(0)
  }, [query, activeTab])

  const fetchResults = async () => {
    setLoading(true)
    const searchTerm = `%${query.trim()}%`
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE

    try {
      let data = []
      let count = 0

      if (activeTab === 'People') {
        const res = await supabase
          .from('profiles')
          .select('*', { count: 'exact' })
          .or(`full_name.ilike.${searchTerm},subjects.cs.{${query.trim()}}`)
          .range(from, to)

        data = res.data || []
        count = res.count || 0
      } else if (activeTab === 'Rooms') {
        const res = await supabase
          .from('rooms')
          .select('*', { count: 'exact' })
          .or(`name.ilike.${searchTerm},description.ilike.${searchTerm}`)
          .range(from, to)

        data = res.data || []
        count = res.count || 0
      } else if (activeTab === 'Posts') {
        const res = await supabase
          .from('posts')
          .select('*, profiles:author_id(id, full_name, avatar_url)', { count: 'exact' })
          .ilike('content', searchTerm)
          .order('created_at', { ascending: false })
          .range(from, to)

        data = (res.data || []).map((post) => ({
          ...post,
          author_name: post.profiles?.full_name,
          author_avatar: post.profiles?.avatar_url,
        }))
        count = res.count || 0
      }

      setResults(data)
      setHasMore(from + data.length < count)
    } catch (err) {
      console.error('Search fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const val = e.target.value
    setInputValue(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (val.trim().length >= 2) {
        setSearchParams({ q: val.trim() })
      }
    }, 300)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    clearTimeout(debounceRef.current)
    if (inputValue.trim().length >= 2) {
      setSearchParams({ q: inputValue.trim() })
    }
  }

  const renderSkeletons = () => {
    if (activeTab === 'People') {
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <MateCardSkeleton key={i} />)}
        </div>
      )
    }
    if (activeTab === 'Rooms') {
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <RoomCardSkeleton key={i} />)}
        </div>
      )
    }
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => <PostCardSkeleton key={i} />)}
      </div>
    )
  }

  const renderResults = () => {
    if (results.length === 0) {
      return (
        <div className="text-center py-16">
          <SearchIcon size={40} className="mx-auto text-slate mb-4" />
          <p className="text-muted text-sm">
            {query.trim().length >= 2
              ? `No ${activeTab.toLowerCase()} found for "${query}"`
              : 'Start typing to search'}
          </p>
        </div>
      )
    }

    if (activeTab === 'People') {
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          {results.map((mate) => (
            <MateCard key={mate.id} mate={mate} connectionStatus={null} onSendNote={() => {}} />
          ))}
        </div>
      )
    }

    if (activeTab === 'Rooms') {
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          {results.map((room) => (
            <RoomCard key={room.id} room={room} isMember={false} onJoin={() => {}} />
          ))}
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {results.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Search input */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="relative max-w-xl">
          <SearchIcon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Search people, rooms, subjects..."
            className="w-full pl-10 pr-4 py-3 text-sm text-cream placeholder:text-muted/60 bg-white/[0.04] border border-white/[0.06] rounded-lg outline-none focus:border-accent/40 transition-colors font-body"
          />
        </div>
      </form>

      {/* Tabs */}
      <div className="flex gap-1 mb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative
              ${activeTab === tab ? 'text-cream' : 'text-muted hover:text-cream/70'}`}
          >
            {tab}
            {activeTab === tab && (
              <div
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent"
                style={{ borderRadius: '1px 1px 0 0' }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? renderSkeletons() : renderResults()}

      {/* Pagination */}
      {!loading && results.length > 0 && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-4 py-2 text-sm text-cream bg-white/[0.04] border border-white/[0.06] rounded-md
                       disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/[0.08] transition-colors"
          >
            Previous
          </button>
          <span className="text-muted text-sm">Page {page + 1}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore}
            className="px-4 py-2 text-sm text-cream bg-white/[0.04] border border-white/[0.06] rounded-md
                       disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/[0.08] transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
