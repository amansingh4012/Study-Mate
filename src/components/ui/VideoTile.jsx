import { useRef, useEffect } from 'react'
import { Pin } from 'lucide-react'

/**
 * VideoTile — renders a single participant's video or avatar fallback
 *
 * Props:
 *  videoTrack   - Agora ILocalVideoTrack / IRemoteVideoTrack (or null)
 *  audioTrack   - Agora audio track (unused visually, kept for API symmetry)
 *  name         - participant display name
 *  isCamOff     - whether camera is off (shows avatar instead)
 *  isPinned     - shows green border highlight
 *  onClick      - optional click handler (for pinning)
 *  className    - extra classes
 */
export default function VideoTile({
  videoTrack,
  audioTrack,
  name = '',
  isCamOff = false,
  isPinned = false,
  onClick,
  className = '',
}) {
  const videoRef = useRef(null)

  // Play / stop the video track into the container
  useEffect(() => {
    if (videoTrack && videoRef.current && !isCamOff) {
      videoTrack.play(videoRef.current)
    }
    return () => {
      videoTrack?.stop?.()
    }
  }, [videoTrack, isCamOff])

  const initial = name?.charAt(0)?.toUpperCase() || '?'

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden bg-[#0A0F1E] ${onClick ? 'cursor-pointer' : ''}
                 ${isPinned ? 'ring-2 ring-accent' : 'ring-1 ring-white/[0.06]'}
                 ${className}`}
      style={{ borderRadius: '8px', minHeight: 0 }}
    >
      {/* Video element */}
      {!isCamOff && videoTrack ? (
        <div
          ref={videoRef}
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: 'cover' }}
        />
      ) : (
        /* Avatar fallback when camera is off */
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="w-16 h-16 rounded-full bg-slate/50 flex items-center justify-center text-muted text-2xl font-bold">
            {initial}
          </div>
        </div>
      )}

      {/* Name label — bottom-left */}
      <div className="absolute bottom-0 left-0 right-0 p-2 flex items-end justify-between">
        <span
          className="px-2 py-0.5 text-xs text-cream font-medium truncate max-w-[70%]"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: '4px' }}
        >
          {name}
        </span>
      </div>

      {/* Pinned badge — top-left */}
      {isPinned && (
        <div className="absolute top-2 left-2">
          <span
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-accent font-bold"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: '4px' }}
          >
            <Pin size={10} /> PINNED
          </span>
        </div>
      )}
    </div>
  )
}
