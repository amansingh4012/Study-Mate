import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isMissingCredentials = !supabaseUrl || !supabaseAnonKey

if (isMissingCredentials) {
  console.error(
    '⚠️ CRITICAL: Missing Supabase environment variables!\n' +
    'VITE_SUPABASE_URL: ' + (supabaseUrl ? '✅ Set' : '❌ Missing') + '\n' +
    'VITE_SUPABASE_ANON_KEY: ' + (supabaseAnonKey ? '✅ Set' : '❌ Missing') + '\n' +
    'If deployed on Vercel, add these in: Vercel Dashboard → Project → Settings → Environment Variables'
  )
}

// Use placeholder URL to prevent crash when credentials are missing
// (auth calls will fail gracefully with a clear error message)
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  }
)
