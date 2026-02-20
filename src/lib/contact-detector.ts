/**
 * Contact CSV Detector — heuristic detection of contact/people CSVs.
 *
 * Analyzes column names to determine if a CSV likely contains contact data.
 * Returns confidence score and detected column mappings.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContactDetectionResult {
  isContact: boolean;
  confidence: number;
  titleColumn: string | null;
  companyColumn: string | null;
  emailColumn: string | null;
  linkedinColumn: string | null;
}

// ---------------------------------------------------------------------------
// Confidence thresholds
// ---------------------------------------------------------------------------

/** Confidence at or above which the UI should suggest ICP classification. */
export const CONFIDENCE_SUGGEST = 0.7;

/** Confidence at or above which auto-classification can trigger. */
export const CONFIDENCE_AUTO = 0.9;

// ---------------------------------------------------------------------------
// Signal definitions
// ---------------------------------------------------------------------------

interface Signal {
  patterns: RegExp[];
  weight: number;
  mapTo?: keyof Pick<
    ContactDetectionResult,
    'titleColumn' | 'companyColumn' | 'emailColumn' | 'linkedinColumn'
  >;
}

const STRONG_SIGNALS: Signal[] = [
  {
    patterns: [/^e[-_ ]?mail$/i, /^email[-_ ]?address$/i],
    weight: 0.3,
    mapTo: 'emailColumn',
  },
  {
    patterns: [/^linkedin$/i, /^linkedin[-_ ]?url$/i, /^linkedin[-_ ]?profile$/i, /^linkedinurl$/i],
    weight: 0.3,
    mapTo: 'linkedinColumn',
  },
  {
    patterns: [
      /^job[-_ ]?title$/i,
      /^title$/i,
      /^position$/i,
      /^role$/i,
      /^jobtitle$/i,
      /^designation$/i,
    ],
    weight: 0.3,
    mapTo: 'titleColumn',
  },
  {
    patterns: [
      /^company$/i,
      /^company[-_ ]?name$/i,
      /^companyname$/i,
      /^organization$/i,
      /^organisation$/i,
      /^employer$/i,
    ],
    weight: 0.3,
    mapTo: 'companyColumn',
  },
];

const MEDIUM_SIGNALS: Signal[] = [
  {
    patterns: [/^name$/i, /^full[-_ ]?name$/i, /^fullname$/i, /^contact[-_ ]?name$/i],
    weight: 0.15,
  },
  {
    patterns: [/^first[-_ ]?name$/i, /^firstname$/i, /^given[-_ ]?name$/i],
    weight: 0.15,
  },
  {
    patterns: [/^last[-_ ]?name$/i, /^lastname$/i, /^surname$/i, /^family[-_ ]?name$/i],
    weight: 0.15,
  },
  {
    patterns: [/^phone$/i, /^phone[-_ ]?number$/i, /^mobile$/i, /^tel$/i, /^telephone$/i],
    weight: 0.15,
  },
  {
    patterns: [/^position$/i, /^job[-_ ]?function$/i],
    weight: 0.15,
    mapTo: 'titleColumn',
  },
];

const WEAK_SIGNALS: Signal[] = [
  { patterns: [/^country$/i, /^location$/i, /^region$/i], weight: 0.05 },
  { patterns: [/^city$/i, /^state$/i, /^address$/i], weight: 0.05 },
  { patterns: [/^website$/i, /^url$/i, /^domain$/i], weight: 0.05 },
  { patterns: [/^industry$/i, /^sector$/i], weight: 0.05 },
];

const ALL_SIGNALS: Signal[] = [...STRONG_SIGNALS, ...MEDIUM_SIGNALS, ...WEAK_SIGNALS];

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Detect whether a set of CSV column names represent a contact/people dataset.
 *
 * @param columns - Array of column header strings from the CSV.
 * @returns Detection result with confidence and mapped column names.
 */
export function detectContactCsv(columns: string[]): ContactDetectionResult {
  let confidence = 0;
  const result: ContactDetectionResult = {
    isContact: false,
    confidence: 0,
    titleColumn: null,
    companyColumn: null,
    emailColumn: null,
    linkedinColumn: null,
  };

  const normalizedColumns = columns.map((c) => c.trim());

  for (const signal of ALL_SIGNALS) {
    for (const col of normalizedColumns) {
      if (signal.patterns.some((p) => p.test(col))) {
        confidence += signal.weight;

        // Map the first matching column to its role (don't overwrite if already set)
        if (signal.mapTo && result[signal.mapTo] === null) {
          result[signal.mapTo] = col;
        }
        break; // Each signal contributes at most once
      }
    }
  }

  // Cap confidence at 1.0
  confidence = Math.min(confidence, 1.0);
  result.confidence = Math.round(confidence * 100) / 100;
  result.isContact = confidence >= 0.4;

  return result;
}
