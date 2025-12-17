import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Initialize Supabase database schema
 * This function should be called once during application startup
 */
export async function initializeDatabase() {
  try {
    // Check if projects table exists
    const { data, error } = await supabase
      .from('projects')
      .select('id')
      .limit(1)

    if (error && error.code === 'PGRST116') {
      // Table doesn't exist, would need to run migrations
      console.log('Database schema needs to be initialized. Please run migrations in Supabase dashboard.')
      return false
    }

    console.log('Database schema is initialized')
    return true
  } catch (error) {
    console.error('Error checking database schema:', error)
    return false
  }
}
