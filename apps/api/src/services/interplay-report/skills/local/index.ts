/**
 * Local Business Skill Bundle
 *
 * Complete skill definitions for local businesses with physical locations.
 * Focus: Calls, store visits, directions, local pack presence, Google Business Profile.
 */

import type { AgentSkillBundle } from '../types.js';
import { localScoutSkill } from './scout.skill.js';
import { localResearcherSkill } from './researcher.skill.js';
import { localSEMSkill } from './sem.skill.js';
import { localSEOSkill } from './seo.skill.js';
import { localDirectorSkill } from './director.skill.js';

export const localSkillBundle: AgentSkillBundle = {
  businessType: 'local',
  version: '1.0.0',

  scout: localScoutSkill,
  researcher: localResearcherSkill,
  sem: localSEMSkill,
  seo: localSEOSkill,
  director: localDirectorSkill,
};
