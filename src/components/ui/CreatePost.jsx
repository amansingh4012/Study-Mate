import { useState, useRef, useEffect } from 'react'
import { Image, X, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const SUBJECTS = [
  'Computer Science', 'Web Dev', 'Machine Learning', 'UI/UX Design',
  'Data Science', 'Cybersecurity', 'Mathematics', 'Physics', 'Chemistry',
  'Biology', 'Medicine', 'Law', 'Business', 'Economics', 'Psychology',
  'History', 'Literature', 'Languages', 'Music Theory', 'Architecture',
]

export default function CreatePost({ onPostCreated, userSubjects = [] }) {
  const { user } = useAuth()
  const [isExpanded, setIsExpanded] = useState(false)
  const [content, setContent] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [content])

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB')
      return
    }

    setImageFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setImagePreview(reader.result)
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async () => {
    if (!content.trim() || !user) return
    
    setLoading(true)
    setError('')

    try {
      let imageUrl = null

      // Upload image if selected
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${user.id}-${Date.now()}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(fileName, imageFile)
        
        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('posts')
          .getPublicUrl(fileName)
        
        imageUrl = publicUrl
      }

      // Create post
      const { data: post, error: postError } = await supabase
        .from('posts')
        .insert({
          author_id: user.id,
          content: content.trim(),
          subject: selectedSubject || null,
          image_url: imageUrl,
        })
        .select(`
          *,
          author:profiles!posts_author_id_fkey(id, full_name, avatar_url)
        `)
        .single()

      if (postError) throw postError

      // Reset form
      setContent('')
      setSelectedSubject('')
      setImageFile(null)
      setImagePreview('')
      setIsExpanded(false)

      onPostCreated?.(post)
    } catch (error) {
      console.error('Error creating post:', error)
      setError('Failed to create post. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Show user's subjects first, then others
  const sortedSubjects = [
    ...userSubjects,
    ...SUBJECTS.filter(s => !userSubjects.includes(s))
  ]

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="w-full p-4 text-left transition-all duration-200 hover:border-white/[0.12]"
        style={{ 
          backgroundColor: '#131929',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '6px'
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate overflow-hidden flex-shrink-0">
            {user?.user_metadata?.avatar_url ? (
              <img 
                src={user.user_metadata.avatar_url} 
                alt="You"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted text-sm">
                {user?.user_metadata?.full_name?.charAt(0) || '?'}
              </div>
            )}
          </div>
          <span className="text-muted text-sm">
            Share something with your study community...
          </span>
        </div>
      </button>
    )
  }

  return (
    <div 
      className="p-4 transition-all duration-200"
      style={{ 
        backgroundColor: '#131929',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '6px'
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-slate overflow-hidden flex-shrink-0">
          {user?.user_metadata?.avatar_url ? (
            <img 
              src={user.user_metadata.avatar_url} 
              alt="You"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted text-sm">
              {user?.user_metadata?.full_name?.charAt(0) || '?'}
            </div>
          )}
        </div>
        
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind?"
            className="w-full bg-transparent text-cream text-sm resize-none outline-none 
                     placeholder:text-muted min-h-[80px]"
            autoFocus
          />
        </div>
      </div>

      {/* Image Preview */}
      {imagePreview && (
        <div className="relative mb-4 inline-block">
          <img 
            src={imagePreview} 
            alt="Preview" 
            className="max-h-48 rounded object-cover"
            style={{ borderRadius: '4px' }}
          />
          <button
            onClick={removeImage}
            className="absolute top-2 right-2 p-1 bg-navy/80 rounded-full 
                     text-cream hover:bg-navy transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Subject Selector */}
      <div className="mb-4">
        <p className="text-muted text-xs mb-2">Tag a subject (optional)</p>
        <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
          {sortedSubjects.slice(0, 10).map((subject) => (
            <button
              key={subject}
              type="button"
              onClick={() => setSelectedSubject(selectedSubject === subject ? '' : subject)}
              className={`px-3 py-1 text-xs border transition-all duration-200
                       ${selectedSubject === subject
                         ? 'bg-accent text-navy border-accent'
                         : 'bg-transparent text-muted border-slate/50 hover:border-cream/30'
                       }`}
              style={{ borderRadius: '12px' }}
            >
              {subject}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-[#E57373] text-sm mb-3">{error}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-muted hover:text-cream transition-colors duration-200"
            title="Add image"
          >
            <Image size={20} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setIsExpanded(false)
              setContent('')
              setSelectedSubject('')
              removeImage()
            }}
            className="px-4 py-2 text-muted text-sm hover:text-cream transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || loading}
            className="px-5 py-2 bg-accent text-navy font-heading font-bold text-sm uppercase
                     hover:bg-accent/90 transition-all duration-200
                     disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center gap-2"
            style={{ borderRadius: '4px' }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Posting...
              </>
            ) : (
              'Post'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
