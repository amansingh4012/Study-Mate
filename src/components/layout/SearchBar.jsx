import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Users, Grid2X2, BookOpen } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function SearchBar() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState({ people: [], rooms: [], subjects: [] })
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults({ people: [], rooms: [], subjects: [] })
      setOpen(false)
      return
    }

    setLoading(true)
    setOpen(true)

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      performSearch(query.trim())
    }, 300)

    return () => clearTimeout(debounceRef.current)
  }, [query])

  const performSearch = async (q) => {
    try {
      const searchTerm = `%${q}%`

      const [peopleRes, roomsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, avatar_url, subjects')
          .or(`full_name.ilike.${searchTerm},subjects.cs.{${q}}`)
          .limit(3),
        supabase
          .from('rooms')
          .select('id, name, description, category')
          .or(`name.ilike.${searchTerm},description.ilike.${searchTerm}`)
          .limit(3),
      ])

      // Extract unique subject tags from people results that match the query
      const matchedSubjects = new Set()
      const lowerQ = q.toLowerCase()
      if (peopleRes.data) {
        peopleRes.data.forEach((p) => {
          if (Array.isArray(p.subjects)) {
            p.subjects.forEach((s) => {
              if (s.toLowerCase().includes(lowerQ)) matchedSubjects.add(s)
            })
          }
        })
      }

      // Also scan a broader set for subjects
      const { data: subjectProfiles } = await supabase
        .from('profiles')
        .select('subjects')
        .not('subjects', 'is', null)
        .limit(50)

      if (subjectProfiles) {
        subjectProfiles.forEach((p) => {
          if (Array.isArray(p.subjects)) {
            p.subjects.forEach((s) => {
              if (s.toLowerCase().includes(lowerQ)) matchedSubjects.add(s)
            })
          }
        })
      }

      setResults({
        people: peopleRes.data || [],
        rooms: roomsRes.data || [],
        subjects: [...matchedSubjects].slice(0, 5),
      })
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (path) => {
    setOpen(false)
    setQuery('')
    setMobileOpen(false)
    navigate(path)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (query.trim().length >= 2) {
      handleSelect(`/search?q=${encodeURIComponent(query.trim())}`)
    }
  }

  const hasResults = results.people.length > 0 || results.rooms.length > 0 || results.subjects.length > 0

  const dropdown = (
    <div
      className="absolute top-full left-0 right-0 mt-1 z-50 overflow-hidden max-h-[420px] overflow-y-auto scrollbar-hide"
      style={{
        backgroundColor: '#131929',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '8px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
      }}
    >
      {loading ? (
        <div className="p-4 space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate/50" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 bg-slate/40 rounded w-28" />
                <div className="h-3 bg-slate/30 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : !hasResults ? (
        <div className="p-6 text-center text-muted text-sm">
          No results for "{query}"
        </div>
      ) : (
        <>
          {/* People */}
          {results.people.length > 0 && (
            <div className="p-2">
              <p className="px-2 py-1.5 text-[11px] font-semibold text-muted uppercase tracking-wider">
                People
              </p>
              {results.people.map((person) => (
                <button
                  key={person.id}
                  onClick={() => handleSelect(`/profile/${person.id}`)}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-white/[0.04] transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-slate flex items-center justify-center overflow-hidden flex-shrink-0">
                    {person.avatar_url ? (
                      <img src={person.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Users size={14} className="text-muted" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-cream text-sm truncate">
                      {person.full_name || 'User'}
                    </p>
                    {Array.isArray(person.subjects) && person.subjects[0] && (
                      <span
                        className="inline-block text-[11px] px-1.5 py-0.5 rounded-full mt-0.5"
                        style={{ backgroundColor: 'rgba(168,255,62,0.1)', color: '#A8FF3E' }}
                      >
                        {person.subjects[0]}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Rooms */}
          {results.rooms.length > 0 && (
            <div className="p-2 border-t border-white/[0.06]">
              <p className="px-2 py-1.5 text-[11px] font-semibold text-muted uppercase tracking-wider">
                Rooms
              </p>
              {results.rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => handleSelect(`/rooms/${room.id}`)}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-white/[0.04] transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-md bg-slate/50 flex items-center justify-center flex-shrink-0">
                    <Grid2X2 size={14} className="text-muted" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-cream text-sm truncate">{room.name}</p>
                    {room.category && (
                      <span className="text-muted text-[11px]">{room.category}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Subjects */}
          {results.subjects.length > 0 && (
            <div className="p-2 border-t border-white/[0.06]">
              <p className="px-2 py-1.5 text-[11px] font-semibold text-muted uppercase tracking-wider">
                Subjects
              </p>
              <div className="flex flex-wrap gap-1.5 px-2 py-1">
                {results.subjects.map((subject) => (
                  <button
                    key={subject}
                    onClick={() => handleSelect(`/find-mate?subject=${encodeURIComponent(subject)}`)}
                    className="text-xs px-2.5 py-1 rounded-full transition-colors hover:opacity-80"
                    style={{ backgroundColor: 'rgba(168,255,62,0.1)', color: '#A8FF3E' }}
                  >
                    {subject}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* See all */}
          <button
            onClick={() => handleSelect(`/search?q=${encodeURIComponent(query.trim())}`)}
            className="w-full px-4 py-3 text-sm text-accent hover:bg-white/[0.04] transition-colors border-t border-white/[0.06] text-center"
          >
            See all results for "{query}"
          </button>
        </>
      )}
    </div>
  )

  return (
    <>
      {/* Desktop search bar */}
      <div ref={containerRef} className="hidden lg:block relative w-[480px]">
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => query.trim().length >= 2 && setOpen(true)}
              placeholder="Search people, rooms, subjects..."
              className="w-full pl-9 pr-8 py-2 text-sm text-cream placeholder:text-muted/60 bg-white/[0.04] border border-white/[0.06] rounded-lg outline-none focus:border-accent/40 transition-colors font-body"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); setOpen(false) }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-cream transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </form>
        {open && dropdown}
      </div>

      {/* Mobile search icon + expandable bar */}
      <div className="lg:hidden">
        {!mobileOpen ? (
          <button
            onClick={() => { setMobileOpen(true); setTimeout(() => inputRef.current?.focus(), 100) }}
            className="p-2 text-muted hover:text-cream transition-colors"
          >
            <Search size={20} />
          </button>
        ) : (
          <div
            ref={containerRef}
            className="fixed inset-x-0 top-0 z-50 p-3"
            style={{ backgroundColor: '#0D1323' }}
          >
            <form onSubmit={handleSubmit} className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => query.trim().length >= 2 && setOpen(true)}
                placeholder="Search people, rooms, subjects..."
                className="w-full pl-9 pr-16 py-2.5 text-sm text-cream placeholder:text-muted/60 bg-white/[0.04] border border-white/[0.06] rounded-lg outline-none focus:border-accent/40 transition-colors font-body"
                autoFocus
              />
              <button
                type="button"
                onClick={() => { setMobileOpen(false); setQuery(''); setOpen(false) }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-cream text-xs font-medium"
              >
                Cancel
              </button>
            </form>
            {open && dropdown}
          </div>
        )}
      </div>
    </>
  )
}
