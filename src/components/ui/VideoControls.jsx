import { Video, VideoOff, PhoneOff } from 'lucide-react'

/**
 * VideoControls — floating controls bar for video calls
 *
 * Props:
 *  isCamOn      - current camera state
 *  onToggleCam  - () => void
 *  onLeave      - () => void
 */
export default function VideoControls({
  isCamOn,
  onToggleCam,
  onLeave,
}) {
  const btn =
    'flex items-center justify-center w-12 h-12 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0B1120]'

  return (
    <div className="flex items-center justify-center gap-4 px-6 py-3 bg-[#0f172a]/90 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl">
      {/* Camera toggle */}
      <button
        onClick={onToggleCam}
        className={`${btn} ${
          isCamOn
            ? 'bg-white/10 hover:bg-white/20 text-white focus:ring-white/40'
            : 'bg-red-500/80 hover:bg-red-500 text-white focus:ring-red-400'
        }`}
        title={isCamOn ? 'Turn off camera' : 'Turn on camera'}
      >
        {isCamOn ? (
          <Video className="w-5 h-5" />
        ) : (
          <VideoOff className="w-5 h-5" />
        )}
      </button>

      {/* Leave call */}
      <button
        onClick={onLeave}
        className={`${btn} bg-red-600 hover:bg-red-500 text-white focus:ring-red-400`}
        title="Leave video call"
      >
        <PhoneOff className="w-5 h-5" />
      </button>
    </div>
  )
}
