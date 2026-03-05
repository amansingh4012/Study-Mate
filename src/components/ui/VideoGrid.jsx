import { useState } from 'react'
import VideoTile from './VideoTile'

const MAX_PER_PAGE = 8

/**
 * VideoGrid — responsive grid that fills its container
 *
 * Grid rules based on participant count (on current page):
 *  1       → 1 col, 1 row   (full area)
 *  2       → 2 cols, 1 row
 *  3-4     → 2 cols, 2 rows
 *  5-6     → 3 cols, 2 rows
 *  7-8     → 4 cols, 2 rows
 *  > 8     → paginated (8 per page)
 */
export default function VideoGrid({
  localVideoTrack,
  localAudioTrack,
  localName = 'You',
  isCamOn = true,
  remoteUsers = [],
  remoteNames = {},
  pinnedUid = null,
  onPin,
  showLocal = true,
}) {
  const [page, setPage] = useState(0)

  // Build participant list: local user first (only if publishing), then remotes
  // Filter out remote spectators (no video) so they don't get an empty tile
  const participants = [
    ...(showLocal
      ? [
          {
            uid: 'local',
            name: localName,
            videoTrack: localVideoTrack?.current || null,
            audioTrack: null,
            isMuted: true,
            isCamOff: !isCamOn,
          },
        ]
      : []),
    ...remoteUsers
      .filter((ru) => ru.hasVideo)
      .map((ru) => ({
        uid: ru.uid,
        name: remoteNames[ru.uid] || `User ${String(ru.uid).slice(0, 4)}`,
        videoTrack: ru.videoTrack || null,
        audioTrack: ru.audioTrack || null,
        isMuted: !ru.hasAudio,
        isCamOff: !ru.hasVideo,
      })),
  ]

  const total = participants.length
  const totalPages = Math.ceil(total / MAX_PER_PAGE)
  const currentPage = Math.min(page, totalPages - 1)
  const pageParticipants = participants.slice(
    currentPage * MAX_PER_PAGE,
    currentPage * MAX_PER_PAGE + MAX_PER_PAGE
  )
  const count = pageParticipants.length

  // Determine grid layout
  let cols, rows
  if (count === 1) { cols = 1; rows = 1 }
  else if (count === 2) { cols = 2; rows = 1 }
  else if (count <= 4) { cols = 2; rows = 2 }
  else if (count <= 6) { cols = 3; rows = 2 }
  else { cols = 4; rows = 2 }

  return (
    <div className="flex flex-col h-full w-full">
      {/* Grid */}
      <div
        className="flex-1 grid gap-2 min-h-0"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
        }}
      >
        {pageParticipants.map((p) => (
          <VideoTile
            key={p.uid}
            videoTrack={p.videoTrack}
            audioTrack={p.audioTrack}
            name={p.name}
            isMuted={p.isMuted}
            isCamOff={p.isCamOff}
            isPinned={pinnedUid === p.uid}
            onClick={() => onPin?.(p.uid === pinnedUid ? null : p.uid)}
            className="w-full h-full"
          />
        ))}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2 flex-shrink-0">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="px-2 py-0.5 text-xs text-muted hover:text-cream disabled:opacity-30 transition-colors"
          >
            ← Prev
          </button>
          <span className="text-xs text-muted">
            {currentPage + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage === totalPages - 1}
            className="px-2 py-0.5 text-xs text-muted hover:text-cream disabled:opacity-30 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
