/**
 * Lead-Gen Skill Bundle
 *
 * Complete skill definitions for lead generation businesses.
 * Focus: Cost per lead optimization, form submissions, phone calls, trust signals.
 */

import type { AgentSkillBundle } from '../types.js';
import { leadGenScoutSkill } from './scout.skill.js';
import { leadGenResearcherSkill } from './researcher.skill.js';
import { leadGenSEMSkill } from './sem.skill.js';
import { leadGenSEOSkill } from './seo.skill.js';
import { leadGenDirectorSkill } from './director.skill.js';

export const leadGenSkillBundle: AgentSkillBundle = {
  businessType: 'lead-gen',
  version: '1.0.0',

  scout: leadGenScoutSkill,
  researcher: leadGenResearcherSkill,
  sem: leadGenSEMSkill,
  seo: leadGenSEOSkill,
  director: leadGenDirectorSkill,
};
