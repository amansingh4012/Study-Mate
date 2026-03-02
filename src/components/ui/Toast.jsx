import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { X, UserPlus, UserCheck, MessageSquare, Heart, Radio } from 'lucide-react'

// Toast context for global access
const ToastContext = createContext(null)

// Get icon based on notification type
const getTypeIcon = (type) => {
  switch (type) {
    case 'mate_request':
      return <UserPlus size={18} className="text-accent" />
    case 'mate_accepted':
      return <UserCheck size={18} className="text-green-500" />
    case 'room_message':
      return <MessageSquare size={18} className="text-blue-400" />
    case 'post_like':
      return <Heart size={18} className="text-red-400" />
    case 'session_live':
      return <Radio size={18} className="text-purple-400" />
    default:
      return <MessageSquare size={18} className="text-accent" />
  }
}

// Individual toast component
function ToastItem({ toast, onRemove }) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    // Auto dismiss after 4 seconds
    const timer = setTimeout(() => {
      setIsExiting(true)
      setTimeout(() => onRemove(toast.id), 300)
    }, 4000)

    return () => clearTimeout(timer)
  }, [toast.id, onRemove])

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => onRemove(toast.id), 300)
  }

  return (
    <div
      className={`flex items-start gap-3 p-4 mb-2 max-w-sm w-full
                 bg-slate/95 backdrop-blur-sm border border-white/10
                 shadow-lg transition-all duration-300 ease-out
                 ${isExiting 
                   ? 'opacity-0 translate-x-full' 
                   : 'opacity-100 translate-x-0'
                 }`}
      style={{ borderRadius: '10px' }}
    >
      {/* Type icon */}
      <div className="flex-shrink-0 mt-0.5">
        {getTypeIcon(toast.type)}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-cream truncate">
          {toast.title}
        </p>
        {toast.message && (
          <p className="text-xs text-muted mt-0.5 line-clamp-2">
            {toast.message}
          </p>
        )}
      </div>
      
      {/* Close button */}
      <button
        onClick={handleClose}
        className="flex-shrink-0 p-1 text-muted hover:text-cream transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  )
}

// Toast container that renders all toasts
export function ToastContainer() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div 
      className="fixed bottom-4 right-4 z-50 flex flex-col-reverse"
      style={{ maxHeight: 'calc(100vh - 2rem)' }}
    >
      {toasts.map((toast) => (
        <ToastItem 
          key={toast.id} 
          toast={toast} 
          onRemove={removeToast} 
        />
      ))}
    </div>
  )
}

// Toast provider component
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev.slice(-4), { ...toast, id }]) // Keep max 5 toasts
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  )
}

// Hook to use toast
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export default ToastProvider
