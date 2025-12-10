import type { AgentSkillBundle } from '../types.js';
import {
  createPlaceholderScoutSkill,
  createPlaceholderResearcherSkill,
  createPlaceholderSEMSkill,
  createPlaceholderSEOSkill,
  createPlaceholderDirectorSkill,
} from '../placeholders/index.js';

// Using placeholders until real skills are implemented in Phase 10
export const leadGenSkillBundle: AgentSkillBundle = {
  businessType: 'lead-gen',
  version: '0.1.0-placeholder',

  scout: createPlaceholderScoutSkill('lead-gen'),
  researcher: createPlaceholderResearcherSkill('lead-gen'),
  sem: createPlaceholderSEMSkill('lead-gen'),
  seo: createPlaceholderSEOSkill('lead-gen'),
  director: createPlaceholderDirectorSkill('lead-gen'),
};
