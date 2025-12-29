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
        name: true,
        websiteUrl: true,
        status: true,
        requestsCount: true,
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
        name: true,
        websiteUrl: true,
        requestsCount: true,
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
 * Create a new project with an API key
 * Returns the raw API key (only shown once)
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

    // Ensure user exists in database
    await prisma.user.upsert({
      where: { userId: userId },
      update: {},
        create: {
          userId: userId,
          email: email,
        },
    });

    // Create project with API key in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          userId,
          name: name.trim(),
          websiteUrl: website_url?.trim() || null,
          requestsCount: 0,
          status: 'PENDING_NS',
          secretKey: rawApiKey, // Using the API key as secret key for now
          // Store the key hash on the project's `api_keys` field (schema no longer has a separate api_keys table)
          api_keys: keyHash,
        },
      })

      return project
    })

    return {
      success: true,
      projectId: result.id,
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
    const authResult = await auth()
    if (!authResult) {
      return {
        success: false,
        error: 'User context not found',
        statusCode: 401,
      }
    }
    const { userId } = authResult

    // Verify user owns the project and increment usage
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: userId,
      },
      select: {
        id: true,
        requestsCount: true,
      },
    })

    if (!project) {
      return {
        success: false,
        error: 'Unauthorized to access this project',
        statusCode: 403,
      }
    }

    // Generate random increment (1-50)
    const increment = Math.floor(Math.random() * 50) + 1
    const newCount = project.requestsCount + increment

    // Update requests_count
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: { requestsCount: newCount },
      select: { requestsCount: true },
    })

    return {
      success: true,
      requests_count: updatedProject.requestsCount,
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
