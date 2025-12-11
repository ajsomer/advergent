/**
 * Ecommerce Skill Bundle
 *
 * Complete skill definitions for ecommerce businesses.
 * Focus: ROAS optimization, Shopping campaigns, product pages, revenue growth.
 */

import type { AgentSkillBundle } from '../types.js';
import { ecommerceScoutSkill } from './scout.skill.js';
import { ecommerceResearcherSkill } from './researcher.skill.js';
import { ecommerceSEMSkill } from './sem.skill.js';
import { ecommerceSEOSkill } from './seo.skill.js';
import { ecommerceDirectorSkill } from './director.skill.js';

export const ecommerceSkillBundle: AgentSkillBundle = {
  businessType: 'ecommerce',
  version: '1.0.0',

  scout: ecommerceScoutSkill,
  researcher: ecommerceResearcherSkill,
  sem: ecommerceSEMSkill,
  seo: ecommerceSEOSkill,
  director: ecommerceDirectorSkill,
};
