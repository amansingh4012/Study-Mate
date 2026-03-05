import { useState, useEffect } from 'react'
import { Flame } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/**
 * Calculate streak + weekly activity from daily_activity rows.
 * @param {Array} rows - Sorted by activity_date DESC
 * @returns {{ currentStreak: number, longestStreak: number, weekMap: Set<string> }}
 */
function computeStreak(rows) {
  if (!rows || rows.length === 0) return { currentStreak: 0, longestStreak: 0, weekMap: new Set() }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = fmt(today)

  // Build set of all active dates
  const activeDates = new Set(rows.map(r => r.activity_date))

  // Week map for last 7 days
  const weekMap = new Set()
  for (let i = 0; i < 7; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    if (activeDates.has(fmt(d))) weekMap.add(fmt(d))
  }

  // Current streak: count consecutive days ending today or yesterday
  let currentStreak = 0
  const startDate = activeDates.has(todayStr) ? new Date(today) : (() => {
    const y = new Date(today)
    y.setDate(y.getDate() - 1)
    return activeDates.has(fmt(y)) ? new Date(y) : null
  })()

  if (startDate) {
    const cursor = new Date(startDate)
    while (activeDates.has(fmt(cursor))) {
      currentStreak++
      cursor.setDate(cursor.getDate() - 1)
    }
  }

  // Longest streak ever
  const sorted = [...activeDates].sort()
  let longestStreak = 0
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1])
    const curr = new Date(sorted[i])
    prev.setDate(prev.getDate() + 1)
    if (fmt(prev) === sorted[i]) {
      run++
    } else {
      run = 1
    }
    longestStreak = Math.max(longestStreak, run)
  }
  if (sorted.length > 0) longestStreak = Math.max(longestStreak, run)

  return { currentStreak, longestStreak, weekMap }
}

function fmt(date) {
  return date.toISOString().split('T')[0]
}

/**
 * Full streak widget for Profile page.
 */
export default function StreakWidget({ userId }) {
  const [data, setData] = useState({ currentStreak: 0, longestStreak: 0, weekMap: new Set() })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    const fetch = async () => {
      setLoading(true)
      const { data: rows } = await supabase
        .from('daily_activity')
        .select('activity_date')
        .eq('user_id', userId)
        .order('activity_date', { ascending: false })
        .limit(365)

      setData(computeStreak(rows || []))
      setLoading(false)
    }
    fetch()
  }, [userId])

  if (loading) {
    return (
      <div
        className="p-5 animate-pulse"
        style={{
          backgroundColor: '#131929',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '6px',
        }}
      >
        <div className="h-10 w-32 bg-slate/30 rounded mb-3" />
        <div className="h-4 w-48 bg-slate/20 rounded" />
      </div>
    )
  }

  const { currentStreak, longestStreak, weekMap } = data
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = fmt(today)

  // Build last 7 days array (Mon→Sun aligned to this week)
  const last7 = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = fmt(d)
    last7.push({
      dateStr,
      dayIndex: d.getDay(), // 0=Sun
      isActive: weekMap.has(dateStr),
      isToday: dateStr === todayStr,
    })
  }

  return (
    <div
      className="p-5"
      style={{
        backgroundColor: '#131929',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '6px',
      }}
    >
      {/* Streak header */}
      <div className="flex items-center gap-3 mb-4">
        <Flame size={28} className="text-accent" />
        <div>
          {currentStreak > 0 ? (
            <>
              <div className="flex items-baseline gap-1.5">
                <span className="font-heading text-3xl text-cream font-bold">{currentStreak}</span>
                <span className="text-muted text-sm">day streak</span>
              </div>
              {currentStreak >= 7 && (
                <span className="text-xs text-accent">🔥 On fire</span>
              )}
            </>
          ) : (
            <span className="text-cream text-sm font-medium">Start your streak today</span>
          )}
        </div>
      </div>

      {/* Longest streak */}
      {longestStreak > 0 && (
        <p className="text-muted text-xs mb-4">
          Longest streak: <span className="text-cream">{longestStreak} days</span>
        </p>
      )}

      {/* Weekly activity grid */}
      <div>
        <p className="text-muted text-[10px] uppercase tracking-wider mb-2">Last 7 days</p>
        <div className="flex gap-2">
          {last7.map((day, i) => {
            // Day label: map JS getDay() (0=Sun) to a label
            const jsDay = day.dayIndex
            const label = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][jsDay]

            return (
              <div key={day.dateStr} className="flex flex-col items-center gap-1">
                <span className="text-muted text-[9px]">{label}</span>
                <div
                  className="w-6 h-6 rounded-sm transition-colors"
                  style={{
                    backgroundColor: day.isActive ? '#A8FF3E' : 'rgba(255,255,255,0.04)',
                    border: day.isToday && !day.isActive
                      ? '1.5px solid #A8FF3E'
                      : day.isActive
                        ? 'none'
                        : '1px solid rgba(255,255,255,0.08)',
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * Compact streak display for sidebar: just flame icon + number.
 */
export function CompactStreak({ userId }) {
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    const fetch = async () => {
      const { data: rows } = await supabase
        .from('daily_activity')
        .select('activity_date')
        .eq('user_id', userId)
        .order('activity_date', { ascending: false })
        .limit(365)

      const { currentStreak } = computeStreak(rows || [])
      setStreak(currentStreak)
      setLoading(false)
    }
    fetch()
  }, [userId])

  if (loading) return null

  return (
    <div
      className="flex items-center gap-2 px-4 py-2.5 mx-3 mt-2"
      style={{
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: '6px',
      }}
    >
      <Flame size={18} className={streak > 0 ? 'text-accent' : 'text-muted'} />
      <span className={`text-sm font-medium ${streak > 0 ? 'text-cream' : 'text-muted'}`}>
        {streak > 0 ? `${streak} day streak` : 'No streak'}
      </span>
    </div>
  )
}
