import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, BookOpen, MessageCircle, Check, Loader2 } from 'lucide-react'

export default function MateCard({ 
  mate, 
  connectionStatus, // null | 'pending' | 'connected'
  onSendNote 
}) {
  const isOnline = mate.last_seen && 
    new Date(mate.last_seen) > new Date(Date.now() - 24 * 60 * 60 * 1000)

  // Get display name: full_name > email username > "User"
  const displayName = mate.full_name?.trim() || (mate.email ? mate.email.split('@')[0] : 'User')

  const studyStyleLabels = {
    quiet: 'Quiet focused',
    collaborative: 'Collaborative',
    mixed: 'Mixed style'
  }

  const availabilityLabels = {
    mornings: 'Mornings',
    afternoons: 'Afternoons',
    evenings: 'Evenings',
    weekends: 'Weekends',
    flexible: 'Flexible'
  }

  return (
    <div 
      className="p-5"
      style={{ 
        backgroundColor: '#131929',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '6px'
      }}
    >
      {/* Top Section */}
      <div className="flex gap-4 mb-4">
        {/* Avatar with online indicator */}
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-slate overflow-hidden">
            {mate.avatar_url ? (
              <img 
                src={mate.avatar_url} 
                alt={mate.full_name || 'User'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted text-lg">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          {/* Online indicator */}
          <div 
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-navy
                       ${isOnline ? 'bg-accent' : 'bg-slate'}`}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-heading text-cream font-semibold truncate">
            {displayName}
          </h3>
          {mate.university && (
            <p className="text-muted text-xs truncate">
              {mate.university}
            </p>
          )}
        </div>
      </div>

      {/* Subject Tags */}
      {mate.subjects?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {mate.subjects.slice(0, 3).map((subject) => (
            <span
              key={subject}
              className="px-2 py-0.5 text-xs border border-accent/40 text-accent"
              style={{ borderRadius: '10px' }}
            >
              {subject}
            </span>
          ))}
          {mate.subjects.length > 3 && (
            <span className="text-muted text-xs">+{mate.subjects.length - 3}</span>
          )}
        </div>
      )}

      {/* Bio excerpt */}
      {mate.bio && (
        <p className="text-muted text-sm mb-3 line-clamp-1">
          {mate.bio}
        </p>
      )}

      {/* Study style & availability */}
      <div className="flex items-center gap-4 mb-4 text-xs text-muted">
        {mate.study_style && (
          <div className="flex items-center gap-1.5">
            <BookOpen size={12} />
            <span>{studyStyleLabels[mate.study_style] || mate.study_style}</span>
          </div>
        )}
        {mate.availability && (
          <div className="flex items-center gap-1.5">
            <Clock size={12} />
            <span>{availabilityLabels[mate.availability] || mate.availability}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-2">
        {connectionStatus === 'connected' ? (
          <Link
            to={`/messages?user=${mate.id}`}
            className="w-full flex items-center justify-center gap-2 py-2.5 
                     bg-accent text-navy font-medium text-sm transition-opacity hover:opacity-90"
            style={{ borderRadius: '4px' }}
          >
            <MessageCircle size={16} />
            Message
          </Link>
        ) : connectionStatus === 'pending' ? (
          <button
            disabled
            className="w-full flex items-center justify-center gap-2 py-2.5 
                     bg-transparent border border-slate/50 text-muted text-sm cursor-not-allowed"
            style={{ borderRadius: '4px' }}
          >
            <Check size={16} />
            Request Sent
          </button>
        ) : (
          <button
            onClick={() => onSendNote(mate)}
            className="w-full py-2.5 bg-transparent border border-cream/30 text-cream 
                     font-medium text-sm transition-all duration-200
                     hover:border-accent hover:text-accent"
            style={{ borderRadius: '4px' }}
          >
            Send Note
          </button>
        )}

        <Link
          to={`/profile/${mate.id}`}
          className="block text-center text-xs text-muted hover:text-cream transition-colors"
        >
          View Profile
        </Link>
      </div>
    </div>
  )
}
