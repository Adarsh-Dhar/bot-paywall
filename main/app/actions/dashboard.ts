'use server'

import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

/**
 * Generate a random API key with the prefix 'gk_live_'
 * Returns a 32-character key (8 chars prefix + 24 chars random)
 */
function generateApiKey(): string {
  const prefix = 'gk_live_'
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let randomPart = ''
  for (let i = 0; i < 24; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return prefix + randomPart
}

/**
 * Hash an API key using bcrypt
 */
async function hashApiKey(key: string): Promise<string> {
  const salt = await bcrypt.genSalt(10)
  return bcrypt.hash(key, salt)
}

/**
 * Fetch all projects for the current authenticated user
 * Returns projects sorted by created_at DESC
 */
export async function getProjects() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return {
        success: false,
        error: 'User context not found',
        statusCode: 401,
      }
    }

    const { data, error } = await supabase
      .from('projects')
      .select('id, user_id, name, website_url, requests_count, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching projects:', error)
      return {
        success: false,
        error: 'Failed to fetch projects',
        statusCode: 500,
      }
    }

    return {
      success: true,
      data: data || [],
      statusCode: 200,
    }
  } catch (error) {
    console.error('Error in getProjects:', error)
    return {
      success: false,
      error: 'Internal server error',
      statusCode: 500,
    }
  }
}

/**
 * Fetch a single project by ID with authorization check
 */
export async function getProject(projectId: string) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return {
        success: false,
        error: 'User context not found',
        statusCode: 401,
      }
    }

    const { data, error } = await supabase
      .from('projects')
      .select('id, user_id, name, website_url, requests_count, created_at, updated_at')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return {
          success: false,
          error: 'Project not found',
          statusCode: 404,
        }
      }
      console.error('Error fetching project:', error)
      return {
        success: false,
        error: 'Failed to fetch project',
        statusCode: 500,
      }
    }

    return {
      success: true,
      data,
      statusCode: 200,
    }
  } catch (error) {
    console.error('Error in getProject:', error)
    return {
      success: false,
      error: 'Internal server error',
      statusCode: 500,
    }
  }
}

/**
 * Create a new project with an API key
 * Returns the raw API key (only shown once)
 */
export async function createProject(formData: FormData) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return {
        success: false,
        error: 'User context not found',
        statusCode: 401,
      }
    }

    const name = formData.get('name') as string
    const website_url = formData.get('website_url') as string | null

    // Validate input
    if (!name || name.trim().length === 0) {
      return {
        success: false,
        error: 'Project name is required',
        statusCode: 400,
      }
    }

    // Generate API key
    const rawApiKey = generateApiKey()
    const keyHash = await hashApiKey(rawApiKey)

    // Create project
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        name: name.trim(),
        website_url: website_url?.trim() || null,
        requests_count: 0,
      })
      .select()
      .single()

    if (projectError) {
      console.error('Error creating project:', projectError)
      return {
        success: false,
        error: 'Failed to create project',
        statusCode: 500,
      }
    }

    // Create API key record
    const { error: keyError } = await supabase.from('api_keys').insert({
      project_id: projectData.id,
      key_hash: keyHash,
      prefix: 'gk_live_',
    })

    if (keyError) {
      console.error('Error creating API key:', keyError)
      // Delete the project if key creation fails
      await supabase.from('projects').delete().eq('id', projectData.id)
      return {
        success: false,
        error: 'Failed to create API key',
        statusCode: 500,
      }
    }

    return {
      success: true,
      projectId: projectData.id,
      apiKey: rawApiKey, // Return raw key only once
      statusCode: 201,
    }
  } catch (error) {
    console.error('Error in createProject:', error)
    return {
      success: false,
      error: 'Internal server error',
      statusCode: 500,
    }
  }
}

/**
 * Increment the usage counter for a project
 * Increments by a random value between 1 and 50
 */
export async function incrementUsage(projectId: string) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return {
        success: false,
        error: 'User context not found',
        statusCode: 401,
      }
    }

    // Verify user owns the project
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('id, user_id, requests_count')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single()

    if (fetchError || !project) {
      return {
        success: false,
        error: 'Unauthorized to access this project',
        statusCode: 403,
      }
    }

    // Generate random increment (1-50)
    const increment = Math.floor(Math.random() * 50) + 1
    const newCount = project.requests_count + increment

    // Update requests_count
    const { data, error } = await supabase
      .from('projects')
      .update({ requests_count: newCount })
      .eq('id', projectId)
      .select()
      .single()

    if (error) {
      console.error('Error incrementing usage:', error)
      return {
        success: false,
        error: 'Failed to increment usage',
        statusCode: 500,
      }
    }

    return {
      success: true,
      requests_count: data.requests_count,
      statusCode: 200,
    }
  } catch (error) {
    console.error('Error in incrementUsage:', error)
    return {
      success: false,
      error: 'Internal server error',
      statusCode: 500,
    }
  }
}
