import { FileText, Users, MessageSquare, Home, Search, Radio } from 'lucide-react'

const icons = {
  posts: FileText,
  mates: Users,
  rooms: MessageSquare,
  messages: MessageSquare,
  home: Home,
  search: Search,
  sessions: Radio
}

export default function EmptyState({ 
  icon = 'posts', 
  title,
  message,
  action,
  onAction 
}) {
  const IconComponent = icons[icon] || FileText

  return (
    <div 
      className="flex flex-col items-center justify-center py-16 px-6"
      style={{ 
        backgroundColor: '#131929',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '6px'
      }}
    >
      <IconComponent 
        size={56} 
        strokeWidth={1.2}
        className="text-muted mb-4" 
      />
      {title && (
        <h3 className="font-heading text-cream text-lg font-bold mb-2 text-center">
          {title}
        </h3>
      )}
      <p className="text-muted text-sm text-center max-w-sm mb-4">
        {message}
      </p>
      {action && onAction && (
        <button
          onClick={onAction}
          className="px-6 py-2.5 bg-accent text-navy font-heading font-bold text-sm
                   transition-opacity hover:opacity-90"
          style={{ borderRadius: '6px' }}
        >
          {action}
        </button>
      )}
    </div>
  )
}

/* Pre-configured empty states for each page */
export function HomeFeedEmpty() {
  return (
    <EmptyState
      icon="home"
      message="Nothing here yet. Follow some subjects to see posts from your community."
    />
  )
}

export function FindMateEmpty() {
  return (
    <EmptyState
      icon="mates"
      message="No mates found for this filter. Try a different subject."
    />
  )
}

export function RoomsEmpty({ onCreate }) {
  return (
    <EmptyState
      icon="rooms"
      message="No rooms yet. Create the first one."
      action="Create Room"
      onAction={onCreate}
    />
  )
}

export function MessagesEmpty() {
  return (
    <EmptyState
      icon="messages"
      message="No conversations yet. Connect with a mate to start chatting."
    />
  )
}

export function SearchEmpty() {
  return (
    <EmptyState
      icon="search"
      message="No results found. Try a different search term."
    />
  )
}

export function SessionsEmpty({ onCreate }) {
  return (
    <EmptyState
      icon="sessions"
      message="No sessions yet. Be the first to go live and share your knowledge."
      action="Start a Session"
      onAction={onCreate}
    />
  )
}

export function ProfilePostsEmpty() {
  return (
    <EmptyState
      icon="posts"
      message="No posts yet."
    />
  )
}
