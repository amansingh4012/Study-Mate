import { useState } from 'react'
import VideoTile from './VideoTile'

const MAX_PER_PAGE = 8

export default function VideoGrid({
  localVideoTrack,
  localAudioTrack,
  localName = 'You',
  isCamOn = true,
  remoteUsers = [],
  remoteNames = {},
  remoteAvatars = {},
  pinnedUid = null,
  onPin,
  showLocal = true,
  speakingUids = new Set(),
  localUid = null,
}) {
  const [page, setPage] = useState(0)

  // Build participant list: local user first, then remotes (include cam-off users)
  const participants = [
    ...(showLocal
      ? [
          {
            uid: 'local',
            name: localName,
            videoTrack: localVideoTrack?.current || null,
            audioTrack: null,
            isMuted: true, // local audio is always muted to self
            isCamOff: !isCamOn,
            avatarUrl: null,
          },
        ]
      : []),
    ...remoteUsers.map((ru) => ({
      uid: ru.uid,
      name: remoteNames[ru.uid] || `User ${String(ru.uid).slice(0, 4)}`,
      videoTrack: ru.videoTrack || null,
      audioTrack: ru.audioTrack || null,
      isMuted: !ru.hasAudio,
      isCamOff: !ru.hasVideo,
      avatarUrl: remoteAvatars[ru.uid] || null,
    })),
  ]

  const total = participants.length

  // ── Pinned layout (70/30 split) ──
  if (pinnedUid && total > 1) {
    const pinned = participants.find((p) => p.uid === pinnedUid)
    const others = participants.filter((p) => p.uid !== pinnedUid)

    if (pinned) {
      return (
        <div className="flex h-full w-full gap-2 p-2">
          {/* Main pinned — 70% */}
          <div className="flex-[7] min-w-0 min-h-0">
            <VideoTile
              key={pinned.uid}
              videoTrack={pinned.videoTrack}
              audioTrack={pinned.audioTrack}
              name={pinned.name}
              isMuted={pinned.isMuted}
              isCamOff={pinned.isCamOff}
              isSpeaking={speakingUids.has(pinned.uid === 'local' ? localUid : pinned.uid)}
              isPinned
              avatarUrl={pinned.avatarUrl}
              onClick={() => onPin?.(null)}
              className="w-full h-full"
            />
          </div>
          {/* Sidebar — 30% scrollable column */}
          <div className="flex-[3] min-w-0 flex flex-col gap-2 overflow-y-auto">
            {others.map((p) => (
              <VideoTile
                key={p.uid}
                videoTrack={p.videoTrack}
                audioTrack={p.audioTrack}
                name={p.name}
                isMuted={p.isMuted}
                isCamOff={p.isCamOff}
                isSpeaking={speakingUids.has(p.uid === 'local' ? localUid : p.uid)}
                isPinned={false}
                avatarUrl={p.avatarUrl}
                onClick={() => onPin?.(p.uid)}
                className="w-full aspect-video flex-shrink-0"
              />
            ))}
          </div>
        </div>
      )
    }
  }

  // ── Standard responsive grid ──
  const totalPages = Math.ceil(total / MAX_PER_PAGE)
  const currentPage = Math.min(page, Math.max(totalPages - 1, 0))
  const pageParticipants = participants.slice(
    currentPage * MAX_PER_PAGE,
    currentPage * MAX_PER_PAGE + MAX_PER_PAGE
  )
  const count = pageParticipants.length

  // Responsive grid rules
  let gridStyle = {}
  let tileClass = 'w-full h-full'

  if (count === 1) {
    gridStyle = { gridTemplateColumns: '1fr', gridTemplateRows: '1fr', maxWidth: '640px', margin: '0 auto' }
  } else if (count === 2) {
    gridStyle = { gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: '1fr' }
  } else if (count === 3) {
    // 2 top + 1 centered bottom
    gridStyle = { gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' }
  } else if (count === 4) {
    gridStyle = { gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' }
  } else if (count <= 6) {
    gridStyle = { gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' }
  } else {
    gridStyle = { gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: `repeat(${Math.ceil(count / 3)}, 1fr)` }
  }

  // For count === 3 layout, use custom spans
  const getSpanStyle = (index) => {
    if (count === 3) {
      if (index < 2) return { gridColumn: `span 2` }
      return { gridColumn: '2 / 4' } // center the 3rd tile
    }
    return {}
  }

  return (
    <div className="flex flex-col h-full w-full">
      <div
        className="flex-1 grid gap-2 min-h-0 p-2"
        style={gridStyle}
      >
        {pageParticipants.map((p, i) => (
          <div key={p.uid} className="min-h-0" style={getSpanStyle(i)}>
            <VideoTile
              videoTrack={p.videoTrack}
              audioTrack={p.audioTrack}
              name={p.name}
              isMuted={p.isMuted}
              isCamOff={p.isCamOff}
              isSpeaking={speakingUids.has(p.uid === 'local' ? localUid : p.uid)}
              isPinned={pinnedUid === p.uid}
              avatarUrl={p.avatarUrl}
              onClick={() => onPin?.(p.uid === pinnedUid ? null : p.uid)}
              className={tileClass}
            />
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2 pb-1 flex-shrink-0">
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
