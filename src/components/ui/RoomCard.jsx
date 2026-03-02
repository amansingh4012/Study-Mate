import { Link } from 'react-router-dom'
import { Users, Radio } from 'lucide-react'

export default function RoomCard({ room, onJoin, isMember }) {
  return (
    <div 
      className="p-5 flex flex-col h-full"
      style={{ 
        backgroundColor: '#131929',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '6px'
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-heading text-cream font-bold text-lg leading-tight mb-1 truncate">
            {room.name}
          </h3>
          {room.description && (
            <p className="text-muted text-sm line-clamp-1">
              {room.description}
            </p>
          )}
        </div>
      </div>

      {/* Category pill */}
      {room.category && (
        <div className="mb-3">
          <span 
            className="inline-block px-2.5 py-1 text-xs border border-accent/40 text-accent"
            style={{ borderRadius: '10px' }}
          >
            {room.category}
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-muted mb-3">
        <div className="flex items-center gap-1.5">
          <Users size={12} />
          <span>{room.member_count || 0} members</span>
        </div>
      </div>

      {/* Creator */}
      {room.creator_name && (
        <p className="text-muted text-xs mb-4">
          Created by {room.creator_name}
        </p>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      {isMember ? (
        <Link
          to={`/rooms/${room.id}`}
          className="w-full py-2.5 bg-accent text-navy font-medium text-sm text-center
                   transition-opacity hover:opacity-90"
          style={{ borderRadius: '4px' }}
        >
          Enter Room
        </Link>
      ) : (
        <button
          onClick={() => onJoin(room)}
          className="w-full py-2.5 bg-transparent border border-accent/50 text-accent 
                   font-medium text-sm transition-all duration-200
                   hover:bg-accent hover:text-navy"
          style={{ borderRadius: '4px' }}
        >
          Join Room
        </button>
      )}
    </div>
  )
}
