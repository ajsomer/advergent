import type { AgentSkillBundle } from '../types.js';
import {
  createPlaceholderScoutSkill,
  createPlaceholderResearcherSkill,
  createPlaceholderSEMSkill,
  createPlaceholderSEOSkill,
  createPlaceholderDirectorSkill,
} from '../placeholders/index.js';

// Using placeholders until real skills are implemented in Phase 10
export const ecommerceSkillBundle: AgentSkillBundle = {
  businessType: 'ecommerce',
  version: '0.1.0-placeholder',

  scout: createPlaceholderScoutSkill('ecommerce'),
  researcher: createPlaceholderResearcherSkill('ecommerce'),
  sem: createPlaceholderSEMSkill('ecommerce'),
  seo: createPlaceholderSEOSkill('ecommerce'),
  director: createPlaceholderDirectorSkill('ecommerce'),
};
