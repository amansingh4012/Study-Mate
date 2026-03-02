/* Skeleton for PostCard */
export function PostCardSkeleton() {
  return (
    <div 
      className="p-5 animate-pulse"
      style={{ 
        backgroundColor: '#131929',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '6px'
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-slate/50" />
        
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {/* Name */}
            <div className="h-4 w-24 bg-slate/50 rounded" />
            {/* Subject tag */}
            <div className="h-5 w-16 bg-slate/30 rounded-full" />
            {/* Time */}
            <div className="h-3 w-12 bg-slate/30 rounded" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-2 mb-3">
        <div className="h-4 bg-slate/40 rounded w-full" />
        <div className="h-4 bg-slate/40 rounded w-5/6" />
        <div className="h-4 bg-slate/40 rounded w-3/4" />
      </div>

      {/* Footer */}
      <div className="flex items-center gap-4 pt-3 border-t border-white/[0.06]">
        <div className="h-7 w-14 bg-slate/30 rounded" />
        <div className="h-7 w-14 bg-slate/30 rounded" />
        <div className="h-7 w-8 bg-slate/30 rounded" />
      </div>
    </div>
  )
}

/* Skeleton for MateCard */
export function MateCardSkeleton() {
  return (
    <div 
      className="p-5 animate-pulse"
      style={{ 
        backgroundColor: '#131929',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '6px'
      }}
    >
      {/* Header with avatar */}
      <div className="flex gap-4 mb-4">
        <div className="w-12 h-12 rounded-full bg-slate/50" />
        <div className="flex-1">
          <div className="h-5 w-32 bg-slate/50 rounded mb-2" />
          <div className="h-3 w-24 bg-slate/30 rounded" />
        </div>
      </div>

      {/* Subject tags */}
      <div className="flex gap-1.5 mb-3">
        <div className="h-6 w-16 bg-slate/30 rounded-full" />
        <div className="h-6 w-20 bg-slate/30 rounded-full" />
        <div className="h-6 w-14 bg-slate/30 rounded-full" />
      </div>

      {/* Bio */}
      <div className="h-4 bg-slate/30 rounded w-full mb-3" />

      {/* Study info */}
      <div className="flex gap-4 mb-4">
        <div className="h-4 w-24 bg-slate/20 rounded" />
        <div className="h-4 w-20 bg-slate/20 rounded" />
      </div>

      {/* Button */}
      <div className="h-10 bg-slate/30 rounded w-full mb-2" />
      <div className="h-4 bg-slate/20 rounded w-20 mx-auto" />
    </div>
  )
}

/* Skeleton for RoomCard */
export function RoomCardSkeleton() {
  return (
    <div 
      className="p-5 flex flex-col h-full animate-pulse"
      style={{ 
        backgroundColor: '#131929',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '6px'
      }}
    >
      {/* Header */}
      <div className="mb-3">
        <div className="h-6 w-3/4 bg-slate/50 rounded mb-2" />
        <div className="h-4 w-full bg-slate/30 rounded" />
      </div>

      {/* Category */}
      <div className="h-6 w-20 bg-slate/30 rounded-full mb-3" />

      {/* Stats */}
      <div className="flex gap-4 mb-3">
        <div className="h-4 w-24 bg-slate/20 rounded" />
        <div className="h-4 w-16 bg-slate/20 rounded" />
      </div>

      {/* Creator */}
      <div className="h-3 w-28 bg-slate/20 rounded mb-4" />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Button */}
      <div className="h-10 bg-slate/30 rounded w-full" />
    </div>
  )
}

/* Skeleton for Message Conversation Item */
export function ConversationSkeleton() {
  return (
    <div className="p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-slate/50" />
        <div className="flex-1">
          <div className="h-4 w-28 bg-slate/50 rounded mb-2" />
          <div className="h-3 w-full bg-slate/30 rounded" />
        </div>
        <div className="h-3 w-10 bg-slate/20 rounded" />
      </div>
    </div>
  )
}

/* Skeleton for Session Card */
export function SessionCardSkeleton() {
  return (
    <div 
      className="p-5 animate-pulse"
      style={{ 
        backgroundColor: '#131929',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '6px'
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-slate/50" />
        <div>
          <div className="h-4 w-24 bg-slate/50 rounded mb-1" />
          <div className="h-3 w-16 bg-slate/30 rounded" />
        </div>
      </div>

      {/* Title */}
      <div className="h-5 w-3/4 bg-slate/50 rounded mb-2" />
      <div className="h-4 w-full bg-slate/30 rounded mb-4" />

      {/* Footer */}
      <div className="flex justify-between">
        <div className="h-4 w-20 bg-slate/30 rounded" />
        <div className="h-4 w-16 bg-slate/30 rounded" />
      </div>
    </div>
  )
}

/* Skeleton for Profile */
export function ProfileSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Cover */}
      <div 
        className="mb-16"
        style={{ 
          backgroundColor: '#131929',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '6px'
        }}
      >
        <div className="h-32 bg-slate/20" />
        <div className="px-6 pb-6">
          <div className="w-20 h-20 rounded-full bg-slate/50 -mt-10 mb-4 border-4 border-navy" />
          <div className="h-6 w-48 bg-slate/50 rounded mb-2" />
          <div className="h-4 w-32 bg-slate/30 rounded mb-4" />
          <div className="flex gap-2">
            <div className="h-6 w-20 bg-slate/30 rounded-full" />
            <div className="h-6 w-24 bg-slate/30 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

/* Skeleton for Room Detail page */
export function RoomDetailSkeleton() {
  return (
    <div className="fade-in animate-pulse">
      {/* Header */}
      <div 
        className="p-4 mb-4"
        style={{ 
          backgroundColor: '#131929',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '6px'
        }}
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-slate/50 rounded" />
          <div className="h-6 w-48 bg-slate/50 rounded" />
        </div>
      </div>
      
      {/* Content */}
      <div 
        className="h-[500px]"
        style={{ 
          backgroundColor: '#131929',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '6px'
        }}
      >
        <div className="p-4 space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-slate/50" />
              <div className="flex-1">
                <div className="h-4 w-24 bg-slate/50 rounded mb-1" />
                <div className="h-4 w-3/4 bg-slate/30 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* Skeleton for Session Room page */
export function SessionRoomSkeleton() {
  return (
    <div className="fade-in animate-pulse">
      {/* Header */}
      <div 
        className="p-4 mb-4"
        style={{ 
          backgroundColor: '#131929',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '6px'
        }}
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-slate/50 rounded" />
          <div className="w-10 h-10 rounded-full bg-slate/50" />
          <div className="flex-1">
            <div className="h-5 w-48 bg-slate/50 rounded mb-1" />
            <div className="h-4 w-32 bg-slate/30 rounded" />
          </div>
        </div>
      </div>
      
      {/* Video area */}
      <div 
        className="h-[300px] mb-4"
        style={{ 
          backgroundColor: '#131929',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '6px'
        }}
      />
      
      {/* Chat area */}
      <div 
        className="h-[200px]"
        style={{ 
          backgroundColor: '#131929',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '6px'
        }}
      >
        <div className="p-4 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-slate/50" />
              <div className="h-4 w-2/3 bg-slate/30 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* Generic skeleton block */
export function SkeletonBlock({ className = '' }) {
  return (
    <div className={`bg-slate/40 rounded animate-pulse ${className}`} />
  )
}
