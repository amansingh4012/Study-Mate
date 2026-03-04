import { supabase } from './supabase'

/**
 * Check if a user's profile has been completed (onboarding data filled).
 * Returns true if the profile is essentially empty and needs onboarding.
 */
export async function isProfileIncomplete(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('bio, subjects, study_style')
      .eq('id', userId)
      .single()

    if (error || !data) return true

    // Profile is incomplete if it has no bio AND no subjects
    return !data.bio && (!data.subjects || data.subjects.length === 0)
  } catch {
    return false // Don't block navigation on network errors
  }
}
