import { useState, useEffect, useRef, useCallback } from 'react'
import { Video, VideoOff, Mic, MicOff, PhoneOff, RefreshCw } from 'lucide-react'

export default function VideoControls({
  isCamOn,
  isMicOn = false,
  onToggleCam,
  onToggleMic,
  onFlipCam,
  onLeave,
}) {
  const [visible, setVisible] = useState(true)
  const hideTimer = useRef(null)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640

  const resetHideTimer = useCallback(() => {
    setVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    if (isMobile) {
      hideTimer.current = setTimeout(() => setVisible(false), 3000)
    }
  }, [isMobile])

  useEffect(() => {
    resetHideTimer()
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current) }
  }, [])

  const btn =
    'flex items-center justify-center w-12 h-12 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0B1120]'

  return (
    <div
      onClick={isMobile ? resetHideTimer : undefined}
      className={`flex items-center justify-center gap-3 px-6 py-3 bg-[#0f172a]/90 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none sm:opacity-100 sm:pointer-events-auto'
      }`}
    >
      {/* Mic toggle */}
      {onToggleMic && (
        <button
          onClick={onToggleMic}
          className={`${btn} ${
            isMicOn
              ? 'bg-green-500/20 hover:bg-green-500/30 text-green-400 focus:ring-green-400'
              : 'bg-red-500/80 hover:bg-red-500 text-white focus:ring-red-400'
          }`}
          title={isMicOn ? 'Mute mic' : 'Unmute mic'}
        >
          {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>
      )}

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
        {isCamOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
      </button>

      {/* Flip camera — mobile only */}
      {isCamOn && onFlipCam && (
        <button
          onClick={onFlipCam}
          className={`${btn} bg-white/10 hover:bg-white/20 text-white focus:ring-white/40 sm:hidden`}
          title="Flip camera"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      )}

      {/* Leave call */}
      <button
        onClick={onLeave}
        className={`${btn} bg-red-600 hover:bg-red-500 text-white focus:ring-red-400 gap-2 w-auto px-5`}
        title="Leave video call"
      >
        <PhoneOff className="w-5 h-5" />
        <span className="text-sm font-medium hidden sm:inline">Leave</span>
      </button>
    </div>
  )
}
