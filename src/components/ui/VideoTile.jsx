import { useRef, useEffect } from 'react'
import { Pin, MicOff } from 'lucide-react'

export default function VideoTile({
  videoTrack,
  audioTrack,
  name = '',
  isCamOff = false,
  isMuted = false,
  isSpeaking = false,
  isPinned = false,
  avatarUrl,
  onClick,
  className = '',
}) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (videoTrack && videoRef.current && !isCamOff) {
      videoTrack.play(videoRef.current)
    }
    return () => {
      videoTrack?.stop?.()
    }
  }, [videoTrack, isCamOff])

  const initial = name?.charAt(0)?.toUpperCase() || '?'

  const ringClass = isSpeaking
    ? 'ring-2 ring-green-400 animate-pulse'
    : isPinned
      ? 'ring-2 ring-accent'
      : 'ring-1 ring-white/[0.06]'

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden bg-[#0A0F1E] ${onClick ? 'cursor-pointer' : ''} ${ringClass} ${className}`}
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
        /* Avatar fallback */
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0d1424]">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="w-16 h-16 rounded-full object-cover ring-2 ring-slate/30"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-slate/40 flex items-center justify-center text-cream/70 text-2xl font-bold font-heading">
              {initial}
            </div>
          )}
          <span className="text-muted text-xs font-medium">{name}</span>
        </div>
      )}

      {/* Name label — bottom-left */}
      <div className="absolute bottom-0 left-0 right-0 p-2 flex items-end justify-between">
        <span
          className="px-2 py-0.5 text-xs text-cream font-medium truncate max-w-[70%]"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: '4px', fontFamily: "'DM Sans', sans-serif", fontSize: '12px' }}
        >
          {name}
        </span>
      </div>

      {/* Mic muted indicator — top-right */}
      {isMuted && (
        <div className="absolute top-2 right-2">
          <span
            className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500/80"
          >
            <MicOff size={12} className="text-white" />
          </span>
        </div>
      )}

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
