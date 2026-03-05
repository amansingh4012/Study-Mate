import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    // Check if dismissed within last 30 days
    const dismissedAt = localStorage.getItem('pwa_install_dismissed')
    if (dismissedAt && Date.now() - Number(dismissedAt) < 30 * 24 * 60 * 60 * 1000) {
      return
    }

    // Only show on mobile
    if (window.innerWidth >= 768) return

    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowPrompt(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    localStorage.setItem('pwa_install_dismissed', String(Date.now()))
    setShowPrompt(false)
    setDeferredPrompt(null)
  }

  if (!showPrompt) return null

  return (
    <div
      className="fixed bottom-[72px] left-3 right-3 z-50 flex items-center gap-3 px-4 py-3 shadow-lg"
      style={{
        backgroundColor: '#131929',
        border: '1px solid rgba(168,255,62,0.2)',
        borderRadius: '8px',
      }}
    >
      <Download size={20} className="text-accent flex-shrink-0" />
      <p className="flex-1 text-cream text-sm">
        Install <span className="font-semibold">StudyMate</span> for quick access
      </p>
      <button
        onClick={handleInstall}
        className="px-3 py-1.5 bg-accent text-navy text-xs font-semibold rounded 
                 hover:opacity-90 transition-opacity flex-shrink-0"
      >
        Install
      </button>
      <button
        onClick={handleDismiss}
        className="p-1 text-muted hover:text-cream transition-colors flex-shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  )
}
