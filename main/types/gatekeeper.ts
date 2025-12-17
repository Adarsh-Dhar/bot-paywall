/**
 * Gatekeeper Types
 * Type definitions for the bot firewall protection system
 */

export type ProjectStatus = 'pending_ns' | 'active' | 'protected';

export interface Project {
  id: string;
  user_id: string;
  name: string;
  zone_id: string | null;
  nameservers: string[] | null;
  status: ProjectStatus;
  secret_key: string;
  created_at: string;
  updated_at?: string;
}

export interface CloudflareZoneResponse {
  success: boolean;
  result?: {
    id: string;
    name: string;
    nameservers: string[];
    status: string;
  };
  errors?: Array<{
    code: number;
    message: string;
  }>;
}

export interface CloudflareZoneStatusResponse {
  success: boolean;
  result?: {
    id: string;
    name: string;
    status: string;
    nameservers: string[];
  };
  errors?: Array<{
    code: number;
    message: string;
  }>;
}

export interface WAFRule {
  description: string;
  expression: string;
  action: 'managed_challenge' | 'block' | 'allow';
  enabled: boolean;
}

export interface WAFRulesetResponse {
  success: boolean;
  result?: {
    id: string;
    rules: WAFRule[];
  };
  errors?: Array<{
    code: number;
    message: string;
  }>;
}

export interface RegisterDomainResponse {
  success: boolean;
  zone_id?: string;
  nameservers?: string[];
  secret_key?: string;
  error?: string;
}

export interface VerifyAndConfigureResponse {
  status: 'success' | 'pending' | 'error';
  message: string;
  protected?: boolean;
}

export interface ProjectWithoutSecretKey extends Omit<Project, 'secret_key'> {
  secret_key_obscured: string;
}
