'use server';

/**
 * Gatekeeper Server Actions
 * Core server-side operations for domain registration and verification
 */

import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase-client';
import {
  createCloudflareZone,
  getCloudflareZoneStatus,
  getOrCreateRuleset,
  deployWAFRule,
} from '@/lib/cloudflare-api';
import { generateSecretKey } from '@/lib/secret-key-generator';
import {
  RegisterDomainResponse,
  VerifyAndConfigureResponse,
  Project,
} from '@/types/gatekeeper';

/**
 * Validate domain format
 */
function isValidDomain(domain: string): boolean {
  // Basic domain validation: must have at least one dot and valid characters
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
  return domainRegex.test(domain);
}

/**
 * Register a new domain and create a Cloudflare zone
 * Requirements: 1.2, 1.3, 1.4
 */
export async function registerDomain(
  domain: string
): Promise<RegisterDomainResponse> {
  try {
    // Get authenticated user
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    // Validate domain format
    if (!isValidDomain(domain)) {
      return {
        success: false,
        error: 'Invalid domain format. Please enter a valid domain name.',
      };
    }

    // Generate secret key
    const secretKey = generateSecretKey();

    // Call Cloudflare API to create zone
    const cfResponse = await createCloudflareZone(domain);

    if (!cfResponse.result) {
      return {
        success: false,
        error: 'Failed to create Cloudflare zone',
      };
    }

    const zoneId = cfResponse.result.id;
    const nameservers = cfResponse.result.nameservers;

    // Insert project record into database
    const { data, error } = await supabaseAdmin
      .from('projects')
      .insert({
        user_id: userId,
        name: domain,
        zone_id: zoneId,
        nameservers: nameservers,
        status: 'pending_ns',
        secret_key: secretKey,
      })
      .select()
      .single();

    if (error) {
      console.error('Database insertion error:', error);
      return {
        success: false,
        error: 'Failed to save project to database',
      };
    }

    return {
      success: true,
      zone_id: zoneId,
      nameservers: nameservers,
      secret_key: secretKey,
    };
  } catch (error) {
    console.error('registerDomain error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred',
    };
  }
}

/**
 * Verify nameserver update and deploy WAF rule
 * Requirements: 3.1, 3.3, 3.4, 4.1
 */
export async function verifyAndConfigure(
  projectId: string
): Promise<VerifyAndConfigureResponse> {
  try {
    // Get authenticated user
    const { userId } = await auth();
    if (!userId) {
      return {
        status: 'error',
        message: 'User not authenticated',
      };
    }

    // Fetch project from database
    const { data: project, error: fetchError } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (fetchError || !project) {
      return {
        status: 'error',
        message: 'Project not found',
      };
    }

    // Verify user ownership
    if (project.user_id !== userId) {
      return {
        status: 'error',
        message: 'Unauthorized: You do not own this project',
      };
    }

    if (!project.zone_id) {
      return {
        status: 'error',
        message: 'Zone ID not found for this project',
      };
    }

    // Check zone status with Cloudflare
    const zoneStatus = await getCloudflareZoneStatus(project.zone_id);

    if (!zoneStatus.result || zoneStatus.result.status !== 'active') {
      return {
        status: 'pending',
        message: 'Nameservers not yet updated. Please update them at your registrar and try again.',
      };
    }

    // Zone is active, deploy WAF rule
    try {
      const rulesetId = await getOrCreateRuleset(project.zone_id);
      await deployWAFRule(project.zone_id, rulesetId, project.secret_key);
    } catch (wafError) {
      console.error('WAF deployment error:', wafError);
      return {
        status: 'error',
        message: 'Failed to deploy protection rules. Please try again.',
      };
    }

    // Update project status to 'protected'
    const { error: updateError } = await supabaseAdmin
      .from('projects')
      .update({ status: 'protected' })
      .eq('id', projectId);

    if (updateError) {
      console.error('Status update error:', updateError);
      return {
        status: 'error',
        message: 'Failed to update project status',
      };
    }

    return {
      status: 'success',
      message: 'Protection Active. Backdoor Ready.',
      protected: true,
    };
  } catch (error) {
    console.error('verifyAndConfigure error:', error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'An error occurred',
    };
  }
}

/**
 * Get all projects for the authenticated user
 * Requirements: 6.1, 7.3
 */
export async function getProjectsByUser(): Promise<Project[]> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return [];
    }

    const { data, error } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching projects:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('getProjectsByUser error:', error);
    return [];
  }
}

/**
 * Get a single project by ID with authorization check
 * Requirements: 7.5
 */
export async function getProjectById(projectId: string): Promise<Project | null> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return null;
    }

    const { data, error } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      console.error('Error fetching project:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('getProjectById error:', error);
    return null;
  }
}
