import { useState, useRef, useCallback, useEffect } from 'react'
import AgoraRTC from 'agora-rtc-sdk-ng'

const APP_ID = import.meta.env.VITE_AGORA_APP_ID

// Create Agora client once
const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })

/**
 * Convert a UUID string to a deterministic 32-bit unsigned integer
 * for use as an Agora UID. This ensures the same user always gets
 * the same numeric UID, so we can map UID → name from the members list.
 */
export function uuidToAgoraUid(uuid) {
  const hex = uuid.replace(/-/g, '').slice(0, 8)
  // Ensure non-zero (Agora treats 0 as auto-assign)
  return (parseInt(hex, 16) || 1) >>> 0
}

export default function useAgora() {
  const [joined, setJoined] = useState(false)
  const [remoteUsers, setRemoteUsers] = useState([])
  const [isMicOn, setIsMicOn] = useState(false)
  const [isCamOn, setIsCamOn] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [joining, setJoining] = useState(false)

  const localAudioTrack = useRef(null)
  const localVideoTrack = useRef(null)
  const facingMode = useRef('user')

  // Handle remote user events
  useEffect(() => {
    const handleUserPublished = async (remoteUser, mediaType) => {
      await client.subscribe(remoteUser, mediaType)

      setRemoteUsers(prev => {
        const exists = prev.find(u => u.uid === remoteUser.uid)
        if (exists) {
          return prev.map(u => u.uid === remoteUser.uid ? remoteUser : u)
        }
        return [...prev, remoteUser]
      })
    }

    const handleUserUnpublished = (remoteUser, mediaType) => {
      setRemoteUsers(prev =>
        prev.map(u => u.uid === remoteUser.uid ? remoteUser : u)
      )
    }

    const handleUserLeft = (remoteUser) => {
      setRemoteUsers(prev => prev.filter(u => u.uid !== remoteUser.uid))
    }

    const handleUserJoined = (remoteUser) => {
      setRemoteUsers(prev => {
        const exists = prev.find(u => u.uid === remoteUser.uid)
        if (exists) return prev
        return [...prev, remoteUser]
      })
    }

    client.on('user-published', handleUserPublished)
    client.on('user-unpublished', handleUserUnpublished)
    client.on('user-left', handleUserLeft)
    client.on('user-joined', handleUserJoined)

    return () => {
      client.off('user-published', handleUserPublished)
      client.off('user-unpublished', handleUserUnpublished)
      client.off('user-left', handleUserLeft)
      client.off('user-joined', handleUserJoined)
    }
  }, [])

  /**
   * Join a channel with camera + mic
   * @param {string} channelName - Agora channel to join
   * @param {string|number} uid - User ID (use Supabase user.id or null for auto)
   * @param {object} options - { audio: true, video: true }
   */
  const join = useCallback(async (channelName, uid = null, options = {}) => {
    if (!APP_ID) {
      console.error('VITE_AGORA_APP_ID not set in .env')
      alert('Agora App ID is missing. Add VITE_AGORA_APP_ID to your .env file.')
      return
    }

    const { video = true } = options

    try {
      setJoining(true)

      // Agora RTC mode requires numeric UID — use the one passed by caller
      await client.join(APP_ID, channelName, null, uid)

      // Create local tracks (audio/mic disabled — video only)
      const tracks = []

      if (video) {
        localVideoTrack.current = await AgoraRTC.createCameraVideoTrack({
          encoderConfig: '480p_1',
        })
        tracks.push(localVideoTrack.current)
        setIsCamOn(true)
      }

      // Publish local tracks
      if (tracks.length > 0) {
        await client.publish(tracks)
      }

      setJoined(true)
    } catch (error) {
      console.error('Error joining Agora channel:', error)
      // Cleanup on failure
      localAudioTrack.current?.close()
      localVideoTrack.current?.close()
      localAudioTrack.current = null
      localVideoTrack.current = null
    } finally {
      setJoining(false)
    }
  }, [])

  /**
   * Leave channel, stop and close all tracks
   */
  const leave = useCallback(async () => {
    try {
      // Stop and close local tracks
      if (localAudioTrack.current) {
        localAudioTrack.current.stop()
        localAudioTrack.current.close()
        localAudioTrack.current = null
      }

      if (localVideoTrack.current) {
        localVideoTrack.current.stop()
        localVideoTrack.current.close()
        localVideoTrack.current = null
      }

      // Leave channel
      await client.leave()

      setRemoteUsers([])
      setJoined(false)
      setIsMicOn(false)
      setIsCamOn(false)
      setIsPublishing(false)
    } catch (error) {
      console.error('Error leaving Agora channel:', error)
    }
  }, [])

  /**
   * Start publishing local audio + video (go live)
   */
  const startPublishing = useCallback(async () => {
    if (!joined) return

    try {
      const tracks = []

      localVideoTrack.current = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: '480p_1',
      })
      tracks.push(localVideoTrack.current)
      setIsCamOn(true)

      await client.publish(tracks)
      setIsPublishing(true)
    } catch (error) {
      console.error('Error starting publish:', error)
      localVideoTrack.current?.close()
      localVideoTrack.current = null
    }
  }, [joined])

  /**
   * Stop publishing (stop local tracks) but stay in channel as viewer
   */
  const stopPublishing = useCallback(async () => {
    try {
      const tracks = []
      if (localAudioTrack.current) tracks.push(localAudioTrack.current)
      if (localVideoTrack.current) tracks.push(localVideoTrack.current)

      if (tracks.length > 0) {
        await client.unpublish(tracks)
      }

      localAudioTrack.current?.stop()
      localAudioTrack.current?.close()
      localAudioTrack.current = null

      localVideoTrack.current?.stop()
      localVideoTrack.current?.close()
      localVideoTrack.current = null

      setIsMicOn(false)
      setIsCamOn(false)
      setIsPublishing(false)
    } catch (error) {
      console.error('Error stopping publish:', error)
    }
  }, [])

  /**
   * Toggle local camera on/off
   */
  const toggleCamera = useCallback(async () => {
    if (!localVideoTrack.current) {
      // Camera was off, create and publish
      try {
        localVideoTrack.current = await AgoraRTC.createCameraVideoTrack({
          encoderConfig: '480p_1',
        })
        await client.publish(localVideoTrack.current)
        setIsCamOn(true)
      } catch (error) {
        console.error('Error enabling camera:', error)
      }
      return
    }

    const newState = !localVideoTrack.current.enabled
    await localVideoTrack.current.setEnabled(newState)
    setIsCamOn(newState)
  }, [])

  /**
   * Flip camera between front ('user') and back ('environment') — mobile only
   */
  const flipCamera = useCallback(async () => {
    if (!localVideoTrack.current) return

    const newMode = facingMode.current === 'user' ? 'environment' : 'user'

    try {
      // Unpublish the current video track
      await client.unpublish(localVideoTrack.current)
      localVideoTrack.current.stop()
      localVideoTrack.current.close()

      // Create a new track with the opposite facingMode
      localVideoTrack.current = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: '480p_1',
        facingMode: newMode,
      })

      await client.publish(localVideoTrack.current)
      facingMode.current = newMode
      setIsCamOn(true)
    } catch (error) {
      console.error('Error flipping camera:', error)
    }
  }, [])

  /**
   * Toggle local microphone on/off
   */
  const toggleMic = useCallback(async () => {
    if (!localAudioTrack.current) {
      // Mic was off, create and publish  
      try {
        localAudioTrack.current = await AgoraRTC.createMicrophoneAudioTrack()
        await client.publish(localAudioTrack.current)
        setIsMicOn(true)
      } catch (error) {
        console.error('Error enabling mic:', error)
      }
      return
    }

    const newState = !localAudioTrack.current.enabled
    await localAudioTrack.current.setEnabled(newState)
    setIsMicOn(newState)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (joined) {
        localAudioTrack.current?.stop()
        localAudioTrack.current?.close()
        localVideoTrack.current?.stop()
        localVideoTrack.current?.close()
        client.leave().catch(() => {})
      }
    }
  }, [joined])

  return {
    client,
    joined,
    joining,
    join,
    leave,
    startPublishing,
    stopPublishing,
    isPublishing,
    toggleCamera,
    flipCamera,
    toggleMic,
    isMicOn,
    isCamOn,
    localAudioTrack,
    localVideoTrack,
    remoteUsers,
  }
}
