/**
 * Skill System - Loader & Registry
 *
 * Provides business-type-aware skill loading with fallback support
 * for unimplemented types.
 */

import type {
  AgentSkillBundle,
  BusinessType,
  ScoutSkillDefinition,
  ResearcherSkillDefinition,
  SEMSkillDefinition,
  SEOSkillDefinition,
  DirectorSkillDefinition,
} from './types.js';
import { logger } from '@/utils/logger.js';

// Import implemented skill bundles
import { ecommerceSkillBundle } from './ecommerce/index.js';
import { leadGenSkillBundle } from './lead-gen/index.js';
import { saasSkillBundle } from './saas/index.js';
import { localSkillBundle } from './local/index.js';

// ============================================================================
// SKILL REGISTRY
// ============================================================================

const skillRegistry: Record<BusinessType, AgentSkillBundle | null> = {
  'ecommerce': ecommerceSkillBundle,
  'lead-gen': leadGenSkillBundle,
  'saas': saasSkillBundle,
  'local': localSkillBundle,
};

// Fallback mappings for unimplemented types (none needed - all types implemented)
const FALLBACK_MAPPINGS: Partial<Record<BusinessType, BusinessType>> = {
  // All business types now have full implementations
};

// ============================================================================
// SKILL LOADER
// ============================================================================

export interface SkillLoadResult {
  bundle: AgentSkillBundle;
  usingFallback: boolean;
  fallbackFrom?: BusinessType;
  warning?: string;
}

/**
 * Load the skill bundle for a given business type.
 * Falls back to a similar business type if the requested type is not implemented.
 */
export function loadSkillBundle(businessType: BusinessType): SkillLoadResult {
  const bundle = skillRegistry[businessType];

  if (bundle) {
    return {
      bundle,
      usingFallback: false,
    };
  }

  // Fall back to mapped type with explicit warning
  const fallbackType = FALLBACK_MAPPINGS[businessType];
  if (fallbackType && skillRegistry[fallbackType]) {
    const warning =
      `Skills for "${businessType}" are not yet implemented. ` +
      `Using "${fallbackType}" skills as a fallback. ` +
      `Some recommendations may not be fully tailored to ${businessType} businesses.`;

    logger.warn(
      {
        requestedType: businessType,
        fallbackType,
      },
      'Using fallback skill bundle'
    );

    return {
      bundle: skillRegistry[fallbackType]!,
      usingFallback: true,
      fallbackFrom: businessType,
      warning,
    };
  }

  // This shouldn't happen if FALLBACK_MAPPINGS is complete
  throw new Error(`No skill bundle or fallback for business type: ${businessType}`);
}

// ============================================================================
// BUSINESS TYPE QUERIES
// ============================================================================

/**
 * Get business types that are fully implemented (not using fallbacks).
 * Use this for user-facing UI that shows available options.
 */
export function getAvailableBusinessTypes(): BusinessType[] {
  return Object.entries(skillRegistry)
    .filter(([_, bundle]) => bundle !== null)
    .map(([type]) => type as BusinessType);
}

/**
 * Get all business types including unimplemented ones.
 * Use this for admin/debug purposes.
 */
export function getAllBusinessTypes(): BusinessType[] {
  return ['ecommerce', 'lead-gen', 'saas', 'local'];
}

/**
 * Check if a business type is fully supported (not using fallback).
 */
export function isBusinessTypeSupported(type: BusinessType): boolean {
  return skillRegistry[type] !== null;
}

// ============================================================================
// INDIVIDUAL SKILL LOADERS
// ============================================================================

/**
 * Load only the Scout skill for a business type.
 */
export function loadScoutSkill(businessType: BusinessType): ScoutSkillDefinition {
  return loadSkillBundle(businessType).bundle.scout;
}

/**
 * Load only the Researcher skill for a business type.
 */
export function loadResearcherSkill(businessType: BusinessType): ResearcherSkillDefinition {
  return loadSkillBundle(businessType).bundle.researcher;
}

/**
 * Load only the SEM skill for a business type.
 */
export function loadSEMSkill(businessType: BusinessType): SEMSkillDefinition {
  return loadSkillBundle(businessType).bundle.sem;
}

/**
 * Load only the SEO skill for a business type.
 */
export function loadSEOSkill(businessType: BusinessType): SEOSkillDefinition {
  return loadSkillBundle(businessType).bundle.seo;
}

/**
 * Load only the Director skill for a business type.
 */
export function loadDirectorSkill(businessType: BusinessType): DirectorSkillDefinition {
  return loadSkillBundle(businessType).bundle.director;
}

// ============================================================================
// TYPE RE-EXPORTS
// ============================================================================

export type {
  // Core types
  BusinessType,
  AgentSkillBundle,
  PriorityLevel,
  ImportanceLevel,
  KPIDefinition,
  ThresholdSet,

  // Scout types
  PriorityRule,
  ScoutSkillDefinition,

  // Researcher types
  PriorityBoost,
  ContentSignal,
  PagePattern,
  ResearcherSkillDefinition,

  // SEM types
  AnalysisPattern,
  OpportunityType,
  SEMExample,
  SEMSkillDefinition,

  // SEO types
  SchemaRule,
  PageTypeSchemaRule,
  ContentPattern,
  TechnicalCheck,
  OnPageFactor,
  SEOExample,
  IssueDefinition,
  SEOSkillDefinition,

  // Director types
  ConflictRule,
  SynergyRule,
  PrioritizationRule,
  DirectorSkillDefinition,
} from './types.js';
