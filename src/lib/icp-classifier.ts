/**
 * ICP Classifier — TypeScript port of filter_icp.py
 *
 * Tier Structure (CMO Framework):
 * - Tier 1: Decision Makers (CEO, CFO, COO, CRO, CCO Commercial, CGO, CBDO, MD, President)
 * - Tier 1.5: Payment & Finance Owners (Head of Payments, Payment Director, FinOps)
 * - Tier 2: Influencers/Scouts (Account Director, VP Partnerships, Operations Director)
 * - Tier 3: VP/EVP/Deputy (VP, SVP, EVP, Deputy roles)
 * - iGaming: Casino/Betting Directors
 * - Board: Low priority (Board Member, Chairman)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IcpTier =
  | 'Tier 1'
  | 'Tier 1.5'
  | 'Tier 2'
  | 'Tier 3'
  | 'iGaming'
  | 'Board';

export interface ContactRow {
  [key: string]: string | undefined;
}

export interface ClassificationResult {
  total: number;
  classified: number;
  excluded: number;
  tiers: Record<IcpTier, number>;
  rows: Array<ContactRow & { icpTier: IcpTier }>;
  rejectedRows: ContactRow[];
}

// ---------------------------------------------------------------------------
// Pattern definitions — exact 1:1 port from Python filter_icp.py
// ---------------------------------------------------------------------------

const TIER_1_PATTERNS: RegExp[] = [
  // C-Suite abbreviations
  /\bCEO\b/i, /\bCFO\b/i, /\bCOO\b/i, /\bCIO\b/i, /\bCRO\b/i,
  /\bCGO\b/i, /\bCBDO\b/i, /\bCBO\b/i, /\bCAO\b/i, /\bCMD\b/i, /\bCDO\b/i,
  // CCO handled specially in getTier()

  // Full C-Suite titles
  /\bChief\s+Executive\s+Officer\b/i,
  /\bChief\s+Financial\s+Officer\b/i,
  /\bChief\s+Operating\s+Officer\b/i,
  // CTO excluded per CMO (ADR-035) — moved to EXCLUDE_PATTERNS
  /\bChief\s+Information\s+Officer\b/i,
  /\bChief\s+Revenue\s+Officer\b/i,
  /\bChief\s+Commercial\s+Officer\b/i,
  /\bChief\s+Growth\s+Officer\b/i,
  /\bChief\s+Business\s+Development\s+Officer\b/i,
  /\bChief\s+Digital\s+Officer\b/i,
  /\bChief\s+Gaming\s+Officer\b/i,

  // Generic Chief * Officer (but not Compliance/Marketing/People/Human/Talent)
  /\bChief\s+(?!Compliance|Marketing|People|Human|Talent)\w+\s+Officer\b/i,

  // Other Tier 1
  /\bManaging\s+Director\b/i,
  /\bManaging\s+Partner\b/i,
  /(?<!Vice )(?<!Deputy )\bPresident\b/i,
  /\bExecutive\s+Director\b/i,
  /\bGeneral\s+Director\b/i,
  /(?<!Deputy )\bGeneral\s+Manager\b/i,
  /\bGM\b/i,
  /\bCSO\b/i,

  // Founders
  /\bFounder\b/i, /\bCo-Founder\b/i, /\bCofounder\b/i, /\bFounding\s+Partner\b/i,

  // Owner
  /\bOwner\b/i,
];

// Tier 1.5: Payment & Finance Owners (critical for Kea)
const TIER_1_5_PATTERNS: RegExp[] = [
  /\bHead\s+of\s+Payments?\b/i,
  /\bPayments?\s+Director\b/i,
  /\bDirector\s+of\s+Payments?\b/i,
  /\bHead\s+of\s+PSP\b/i,
  /\bPSP\s+Director\b/i,
  /\bFinOps\s+Director\b/i,
  /\bHead\s+of\s+Finance\b/i,
  /\bFinance\s+Director\b/i,
  /\bDirector\s+of\s+Finance\b/i,
  /\bHead\s+of\s+Treasury\b/i,
  /\bTreasury\s+Director\b/i,
  /\bHead\s+of\s+Financial\s+Operations\b/i,
];

// Tier 2: Influencers/Scouts
const TIER_2_PATTERNS: RegExp[] = [
  /\bAccount\s+Director\b/i,
  /\bVP\s+(?:of\s+)?Partnerships?\b/i,
  /\bVice\s+President\s+(?:of\s+)?Partnerships?\b/i,
  /\bOperations\s+Director\b/i,
  /\bDirector\s+of\s+Operations\b/i,
  /\bRegional\s+Director\b/i,
  /\bBusiness\s+Development\s+Director\b/i,
  /\bDirector\s+of\s+Business\s+Development\b/i,
  /\bPartnership\s+Director\b/i,
  /\bDirector\s+of\s+Partnerships?\b/i,
  /\bCountry\s+Manager\b/i,
  /\bRegional\s+Manager\b/i,
];

// Tier 3: VP/EVP/Deputy
const TIER_3_PATTERNS: RegExp[] = [
  /\bVice\s+President\b/i,
  /\bVP\b/i,
  /\bSVP\b/i, /\bSenior\s+Vice\s+President\b/i,
  /\bEVP\b/i, /\bExecutive\s+Vice\s+President\b/i,

  // Deputy roles
  /\bDeputy\s+General\s+Manager\b/i,
  /\bDeputy\s+Vice\s+President\b/i,
  /\bDeputy\s+Director\b/i,
  /\bDeputy\s+CEO\b/i,
  /\bDeputy\s+CFO\b/i,
  /\bDeputy\s+COO\b/i,
  /\bDeputy\s+Managing\s+Director\b/i,
];

// iGaming Tier
const IGAMING_PATTERNS: RegExp[] = [
  /\bBetting\s+Director\b/i,
  /\biGaming\s+Director\b/i,
  /\bGambling\s+Director\b/i,
  /\bGaming\s+Director\b/i,
  /\bHead\s+of\s+Casino\b/i,
  /\bHead\s+of\s+Gaming\b/i,
  /\bHead\s+of\s+Betting\b/i,
  /\bHead\s+of\s+iGaming\b/i,
  /\bSlot\s+Director\b/i,
  /\bSVP\s+iGaming\b/i,
  /\bSVP\s+iLottery\b/i,
  /\bCasino\s+Director\b/i,
  /\bDirector\s+of\s+Casino\b/i,
  /\bDirector\s+of\s+Gaming\b/i,
  /\bDirector\s+of\s+iGaming\b/i,
];

// Board Tier (low priority)
const BOARD_PATTERNS: RegExp[] = [
  /\bChairman\b/i, /\bChairperson\b/i, /\bChairwoman\b/i,
  /\bVice\s+Chairman\b/i,
  /\bBoard\s+Member\b/i,
  /\bBoard\s+Director\b/i,
  /\bMember\s+of\s+(?:the\s+)?Board\b/i,
];

// Generic Director/Head (fallback to Tier 2)
const GENERIC_DIRECTOR_HEAD_PATTERNS: RegExp[] = [
  /\bDirector\b/i,
  /\bHead\s+of\b/i,
  /\bGlobal\s+Head\b/i,
  /\bRegional\s+Head\b/i,
  /\bSenior\s+Director\b/i,
];

// ---------------------------------------------------------------------------
// Exclude patterns
// ---------------------------------------------------------------------------

const EXCLUDE_PATTERNS: RegExp[] = [
  // Marketing
  /\bCMO\b/i, /\bChief\s+Marketing\s+Officer\b/i,
  /\bHead\s+of\s+Marketing\b/i, /\bMarketing\s+Director\b/i,
  /\bDirector\s+of\s+Marketing\b/i,
  /\bHead\s+of\s+Growth\b/i, /\bHead\s+of\s+Brand\b/i,
  /\bGrowth\s+Director\b/i, /\bBrand\s+Director\b/i,
  /\bMarketing\s+Manager\b/i, /\bGrowth\s+Manager\b/i,
  /\bVP\s+(?:of\s+)?Marketing\b/i, /\bVP\s+(?:of\s+)?Growth\b/i,

  // Compliance
  /\bCompliance\b/i,
  /\bChief\s+Compliance\s+Officer\b/i,
  /\bHead\s+of\s+Compliance\b/i,
  /\bRegulatory\b/i,
  /\bResponsible\s+Gaming\b/i,

  // Client/Customer
  /\bClient\b/i,
  /\bCustomer\b/i,

  // Policy/Product/Research
  /\bPolicy\b/i,
  /\bProducts?\b/i,
  /\bResearch\b/i,

  // Art/Creative (Session 68)
  /\bArt\s+Director\b/i,
  /\bCreative\s+Director\b/i,

  // Engineering/Tech roles (Session 68, ADR-035 extension)
  /\bHead\s+of\s+Engineering\b/i,
  /\bEngineering\s+Director\b/i,
  /\bDirector\s+of\s+Engineering\b/i,

  // SEO/CRM (Session 68)
  /\bHead\s+of\s+SEO\b/i,
  /\bSEO\s+Director\b/i,
  /\bDirector\s+of\s+SEO\b/i,
  /\bHead\s+of\s+CRM\b/i,
  /\bCRM\s+Director\b/i,
  /\bDirector\s+of\s+CRM\b/i,

  // Design (Session 68)
  /\bHead\s+of\s+Design\b/i,
  /\bDesign\s+Director\b/i,
  /\bDirector\s+of\s+Design\b/i,

  // Events (Session 68)
  /\bHead\s+of\s+Events?\b/i,
  /\bEvents?\s+Director\b/i,
  /\bDirector\s+of\s+Events?\b/i,

  // Project/Delivery (Session 68)
  /\bHead\s+of\s+Project\b/i,
  /\bProject\s+Director\b/i,
  /\bDirector\s+of\s+Project\b/i,

  // Studio (Session 68)
  /\bStudio\s+Director\b/i,
  /\bHead\s+of\s+Studio\b/i,
  /\bDirector\s+of\s+Studio\b/i,

  // R&D (Session 68)
  /\bR&D\s+Director\b/i,
  /\bHead\s+of\s+R&D\b/i,
  /\bDirector\s+of\s+R&D\b/i,
  /\bR\s*&\s*D\b/i,

  // Acquisition/Retention/Performance (Session 68)
  /\bHead\s+of\s+Acquisition\b/i,
  /\bAcquisition\s+Director\b/i,
  /\bDirector\s+of\s+Acquisition\b/i,
  /\bHead\s+of\s+Retention\b/i,
  /\bRetention\s+Director\b/i,
  /\bDirector\s+of\s+Retention\b/i,
  /\bHead\s+of\s+Performance\b/i,
  /\bPerformance\s+Director\b/i,
  /\bDirector\s+of\s+Performance\b/i,

  // Digital (Session 68)
  /\bHead\s+of\s+Digital\b/i,
  /\bDigital\s+Director\b/i,
  /\bDirector\s+of\s+Digital\b/i,

  // Sales
  /\bSales\b/i,
  /\bAccount\s+Manager\b/i,
  /\bAccount\s+Executive\b/i,
  /\bKey\s+Account\b/i,

  // Risk/Legal/HR/IT
  /\bRisk\s+Management\b/i,
  /\bRisk\s+Officer\b/i,
  /\bChief\s+Risk\s+Officer\b/i,
  /\bLegal\b/i,
  /\bGeneral\s+Counsel\b/i,
  /\bHR\b/i, /\bHuman\s+Resources\b/i,
  /\bChief\s+People\s+Officer\b/i,
  /\bChief\s+Human\s+Resources\b/i,
  /\bIT\b(?!\s*Director)/i, /\bInformation\s+Technology\b/i,
  /\bRecruitment\b/i, /\bRecruiter\b/i, /\bTalent\s+Acquisition\b/i,

  // Spanish
  /\bSeguridad\b/i,

  // Non-decision makers
  /\bAnalyst\b/i,
  /\bAssociate\b/i,
  /\bConsultant\b/i,
  /\bSupport\b/i,
  /\bAssistant\b/i,
  /\bIntern\b/i,
  /\bTrainee\b/i,
  /\bJunior\b/i,
  /\bCoordinator\b/i,
  /\bSpecialist\b/i,
  /\bAgent\b/i,
  /\bAttendee\b/i,
  /\bVisitor\b/i,
  /\bDelegate\b/i,
  /\bRepresentative\b/i,

  // Generic exclusions
  /\bManager\b(?!\s*Director)/i,
  /\bEngineer\b/i,
  /\bDeveloper\b/i,
  /\bDesigner\b/i,
  /\bArchitect\b(?!\s*Director)/i,
  /\bProgrammer\b/i,
  /\bTester\b/i,
  /\bQA\b/i,
  /\bWriter\b/i,
  /\bEditor\b/i,
  /\bContent\b/i,
  /\bCommunity\b/i,
  /\bSocial\s+Media\b/i,
  /\bInfluencer\b/i,
  /\bAmbassador\b/i,
  /\bStudent\b/i,
  /\bProfessor\b/i,
  /\bTeacher\b/i,
  /\bAcademic\b/i,
  /\bAccountant\b/i,
  /\bBookkeeper\b/i,
  /\bSecretary\b/i,
  /\bReceptionist\b/i,
  /\bAdmin\b(?!istrator)/i,
];

// Non-relevant industries for Founders
const NON_RELEVANT_INDUSTRIES: string[] = [
  'marketing', 'media', 'advertising', 'agency', 'creative',
  'pr ', 'public relations', 'social media', 'content',
];

// CTO patterns (ADR-035) — separate for dual-role logic
const CTO_PATTERNS: RegExp[] = [
  /\bCTO\b/i, /\bChief\s+Technology\s+Officer\b/i, /\bChief\s+Technical\s+Officer\b/i,
];
// If title also contains these, keep (dual role like "CEO & CTO")
const CTO_KEEP_PATTERNS: RegExp[] = [
  /\bCEO\b/i, /\bCFO\b/i, /\bCOO\b/i, /\bFounder\b/i, /Co.Founder/i,
];

// Exempt Manager patterns — these specific Manager titles ARE ICP
const EXEMPT_PATTERNS: RegExp[] = [
  /\bGeneral\s+Manager\b/i,
  /\bCountry\s+Manager\b/i,
  /\bRegional\s+Manager\b/i,
];

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Check if title matches any exclude pattern.
 * Exact port of Python matches_exclude().
 */
export function matchesExclude(title: string): boolean {
  if (!title) return false;

  // Exempt specific Manager titles that ARE ICP
  if (EXEMPT_PATTERNS.some((p) => p.test(title))) {
    return false;
  }

  // CTO check with dual-role override (ADR-035)
  const isCto = CTO_PATTERNS.some((p) => p.test(title));
  if (isCto) {
    const hasOtherRole = CTO_KEEP_PATTERNS.some((p) => p.test(title));
    if (!hasOtherRole) {
      return true; // CTO-only -> exclude
    }
    // dual role (CEO & CTO) -> don't exclude here, let tier matching handle it
  }

  // Bare "Director" rule (Session 68): title is just "Director" with no qualifier
  const normalized = title.replace(/\s+/g, ' ').trim();
  if (normalized.toLowerCase() === 'director') {
    return true;
  }

  return EXCLUDE_PATTERNS.some((p) => p.test(title));
}

/**
 * Determine ICP tier based on CMO framework.
 * Returns null if not ICP.
 * Exact port of Python get_tier().
 */
export function getTier(title: string, company?: string): IcpTier | null {
  if (!title || title.trim() === '') return null;

  // Fix truncated C-suite titles (SiGMA truncates at ~20 chars)
  // "Chief Executive Offi" -> "Chief Executive Officer"
  if (/^Chief\s+/i.test(title)) {
    title = title.replace(/\bOffi\w*$/, 'Officer');
  }

  // First check exclusions
  if (matchesExclude(title)) return null;

  const titleUpper = title.toUpperCase();

  // Special handling for CCO (use \b to avoid matching "Account" which contains "cco")
  const hasCco = /\bCCO\b/i.test(title);
  if (hasCco || titleUpper.includes('CHIEF C')) {
    // CCO = Chief Compliance Officer -> EXCLUDE
    if (titleUpper.includes('COMPLIANCE')) return null;
    // CCO = Chief Commercial Officer -> Tier 1
    if (titleUpper.includes('COMMERCIAL')) return 'Tier 1';
    // Ambiguous CCO - assume Commercial for iGaming conference
    if (hasCco && !titleUpper.includes('COMPLIANCE')) return 'Tier 1';
  }

  // Check Tier 1.5 first (more specific)
  for (const pattern of TIER_1_5_PATTERNS) {
    if (pattern.test(title)) return 'Tier 1.5';
  }

  // Check Tier 1
  for (const pattern of TIER_1_PATTERNS) {
    if (pattern.test(title)) {
      // Check if Founder is from non-relevant industry
      if (titleUpper.includes('FOUNDER')) {
        const companyLower = (company ?? '').toLowerCase();
        for (const nonRel of NON_RELEVANT_INDUSTRIES) {
          if (companyLower.includes(nonRel)) {
            return null; // Exclude marketing/media agency founders
          }
        }
      }
      return 'Tier 1';
    }
  }

  // Check iGaming tier
  for (const pattern of IGAMING_PATTERNS) {
    if (pattern.test(title)) return 'iGaming';
  }

  // Check Tier 2 (specific influencer roles)
  for (const pattern of TIER_2_PATTERNS) {
    if (pattern.test(title)) return 'Tier 2';
  }

  // Check Tier 3 (VP/Deputy)
  for (const pattern of TIER_3_PATTERNS) {
    if (pattern.test(title)) return 'Tier 3';
  }

  // Check Board
  for (const pattern of BOARD_PATTERNS) {
    if (pattern.test(title)) return 'Board';
  }

  // Check generic Director/Head -> Tier 2
  for (const pattern of GENERIC_DIRECTOR_HEAD_PATTERNS) {
    if (pattern.test(title)) return 'Tier 2';
  }

  return null;
}

/**
 * Batch classify an array of contact rows.
 * Exact port of the main() classification loop.
 */
export function classifyContacts(
  rows: ContactRow[],
  titleCol: string,
  companyCol?: string,
): ClassificationResult {
  const tiers: Record<IcpTier, number> = {
    'Tier 1': 0,
    'Tier 1.5': 0,
    'Tier 2': 0,
    'Tier 3': 0,
    iGaming: 0,
    Board: 0,
  };
  const classified: Array<ContactRow & { icpTier: IcpTier }> = [];
  const rejectedRows: ContactRow[] = [];

  for (const row of rows) {
    const title = row[titleCol] ?? '';
    const company = companyCol ? (row[companyCol] ?? '') : '';
    const tier = getTier(title, company);

    if (tier) {
      tiers[tier]++;
      classified.push({ ...row, icpTier: tier });
    } else {
      rejectedRows.push(row);
    }
  }

  return {
    total: rows.length,
    classified: classified.length,
    excluded: rejectedRows.length,
    tiers,
    rows: classified,
    rejectedRows,
  };
}
