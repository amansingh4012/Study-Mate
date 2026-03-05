import { supabase } from './supabase'

/**
 * Log a daily activity for streak tracking.
 * Upserts into daily_activity, appending the activity type if not already present.
 */
export async function logActivity(userId, activityType) {
  if (!userId || !activityType) return

  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  try {
    // Try to fetch existing row for today
    const { data: existing } = await supabase
      .from('daily_activity')
      .select('activity_types')
      .eq('user_id', userId)
      .eq('activity_date', today)
      .maybeSingle()

    if (existing) {
      // Append type if not already present
      const types = existing.activity_types || []
      if (!types.includes(activityType)) {
        await supabase
          .from('daily_activity')
          .update({ activity_types: [...types, activityType] })
          .eq('user_id', userId)
          .eq('activity_date', today)
      }
    } else {
      // Insert new row
      await supabase
        .from('daily_activity')
        .insert({
          user_id: userId,
          activity_date: today,
          activity_types: [activityType],
        })
    }
  } catch (err) {
    // Non-critical — don't break the main action
    console.warn('Activity log failed:', err)
  }
}
