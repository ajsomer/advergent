/**
 * SaaS Skill Bundle
 *
 * Complete skill definitions for SaaS businesses.
 * Focus: Customer acquisition cost, trial signups, demo requests, comparison content.
 */

import type { AgentSkillBundle } from '../types.js';
import { saasScoutSkill } from './scout.skill.js';
import { saasResearcherSkill } from './researcher.skill.js';
import { saasSEMSkill } from './sem.skill.js';
import { saasSEOSkill } from './seo.skill.js';
import { saasDirectorSkill } from './director.skill.js';

export const saasSkillBundle: AgentSkillBundle = {
  businessType: 'saas',
  version: '1.0.0',

  scout: saasScoutSkill,
  researcher: saasResearcherSkill,
  sem: saasSEMSkill,
  seo: saasSEOSkill,
  director: saasDirectorSkill,
};
