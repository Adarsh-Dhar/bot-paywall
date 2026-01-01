'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
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
    const authResult = await auth()
    if (!authResult) {
      return {
        success: false,
        error: 'User context not found',
        statusCode: 401,
      }
    }
    const { userId } = authResult

    const projects = await prisma.project.findMany({
      where: { userId },
      select: {
        id: true,
        userId: true,
        websiteUrl: true,
        zoneId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return {
      success: true,
      data: projects,
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
    const authResult = await auth()
    if (!authResult) {
      return {
        success: false,
        error: 'User context not found',
        statusCode: 401,
      }
    }
    const { userId } = authResult

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: userId,
      },
      select: {
        id: true,
        userId: true,
        websiteUrl: true,
        zoneId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!project) {
      return {
        success: false,
        error: 'Project not found',
        statusCode: 404,
      }
    }

    return {
      success: true,
      data: project,
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
 * Create a new project
 * Note: With the new schema, projects are created via connect-cloudflare flow
 * This function is kept for backward compatibility if needed
 */
export async function createProject(formData: FormData) {
  try {
    const authResult = await auth()
    if (!authResult) {
      return {
        success: false,
        error: 'User context not found',
        statusCode: 401,
      }
    }
    const { userId, email } = authResult

    const websiteUrl = formData.get('website_url') as string | null

    // Validate input
    if (!websiteUrl || websiteUrl.trim().length === 0) {
      return {
        success: false,
        error: 'Website URL is required',
        statusCode: 400,
      }
    }

    // Ensure user exists in database
    await prisma.user.upsert({
      where: { userId: userId },
      update: {},
      create: {
        userId: userId,
        email: email,
      },
    });

    // Return error - projects should be created via connect-cloudflare flow
    return {
      success: false,
      error: 'Please use the Connect Cloudflare flow to create projects',
      statusCode: 400,
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
 * Note: This function is no longer used with the new schema
 * Keeping for backward compatibility
 */
export async function incrementUsage(projectId: string) {
  try {
    const authResult = await auth()
    if (!authResult) {
      return {
        success: false,
        error: 'User context not found',
        statusCode: 401,
      }
    }
    const { userId } = authResult

    // Verify user owns the project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: userId,
      },
      select: {
        id: true,
      },
    })

    if (!project) {
      return {
        success: false,
        error: 'Unauthorized to access this project',
        statusCode: 403,
      }
    }

    return {
      success: true,
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
