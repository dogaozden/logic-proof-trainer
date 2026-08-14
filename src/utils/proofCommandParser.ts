import type { InferenceRule, EquivalenceRule, ProofTechnique } from '../types';
import { inferenceRuleInfo, equivalenceRuleInfo, proofTechniqueInfo } from '../types';

// Create reverse lookup maps from abbreviations to rule keys
// Includes official abbreviations plus common shorthands
export const abbrevToInference: Record<string, InferenceRule> = {};
for (const [key, info] of Object.entries(inferenceRuleInfo)) {
  abbrevToInference[info.abbrev.toLowerCase()] = key as InferenceRule;
}
// Add shorthand aliases for inference rules - match rules.md abbreviations
const inferenceAliases: Record<string, InferenceRule> = {
  // Modus Ponens (MP)
  'modus': 'modusPonens',
  'ponens': 'modusPonens',
  // Modus Tollens (MT)
  'tollens': 'modusTollens',
  // Disjunctive Syllogism (DS)
  'disj': 'disjunctiveSyllogism',
  'disjsyl': 'disjunctiveSyllogism',
  // Simplification (Simp)
  'simple': 'simplification',
  // Conjunction (Conj)
  'and': 'conjunction',
  // Hypothetical Syllogism (HS)
  'hyp': 'hypotheticalSyllogism',
  'hypo': 'hypotheticalSyllogism',
  'syl': 'hypotheticalSyllogism',
  // Addition (Add)
  'or': 'addition',
  // Constructive Dilemma (CD)
  'dil': 'constructiveDilemma',
  'dilemma': 'constructiveDilemma',
};
Object.assign(abbrevToInference, inferenceAliases);

export const abbrevToEquivalence: Record<string, EquivalenceRule> = {};
for (const [key, info] of Object.entries(equivalenceRuleInfo)) {
  abbrevToEquivalence[info.abbrev.toLowerCase()] = key as EquivalenceRule;
}
// Add shorthand aliases for equivalence rules - match rules.md abbreviations
const equivalenceAliases: Record<string, EquivalenceRule> = {
  // Double Negation (DN)
  'dn': 'doubleNegation',
  // DeMorgan's Theorem (DeM)
  'demorgan': 'deMorgan',
  'morgan': 'deMorgan',
  'dm': 'deMorgan',
  // Commutation (Comm)
  'com': 'commutation',
  // Association (Assoc)
  'associate': 'association',
  // Distribution (Dist)
  'distrib': 'distribution',
  'distribute': 'distribution',
  // Contraposition (Contra)
  'contrap': 'contraposition',
  'trans': 'contraposition',
  // Implication (Impl)
  'imp': 'implication',
  'impl': 'implication',
  // Exportation (Exp)
  'export': 'exportation',
  // Tautology (Taut)
  // (abbrev is already 'taut')
  // Equivalence (Equiv)
  'eq': 'equivalence',
  'bicon': 'equivalence',
};
Object.assign(abbrevToEquivalence, equivalenceAliases);

export const abbrevToTechnique: Record<string, ProofTechnique> = {};
for (const [key, info] of Object.entries(proofTechniqueInfo)) {
  abbrevToTechnique[info.abbrev.toLowerCase()] = key as ProofTechnique;
}
// Add shorthand aliases for proof techniques
const techniqueAliases: Record<string, ProofTechnique> = {
  'conditional': 'conditionalProof',
  'cond': 'conditionalProof',
  'condproof': 'conditionalProof',
  'indirect': 'indirectProof',
  'ind': 'indirectProof',
  'indproof': 'indirectProof',
  'raa': 'indirectProof',  // Reductio ad absurdum
  // Legacy ~I aliases now map to IP (IP handles both directions)
  'negintro': 'indirectProof',
  'negi': 'indirectProof',
  '~i': 'indirectProof',
  'ni': 'indirectProof',
};
Object.assign(abbrevToTechnique, techniqueAliases);

// =============================================================================
// UNIFIED INPUT PARSER
// =============================================================================
// Handles all input formats for proof commands in a clean, prioritized way.
//
// SUPPORTED FORMATS:
//
// 1. SUBPROOF CLOSE (with line range):
//    - "P > Q 2-5 CP"       → Close CP subproof with formula "P > Q", lines 2-5
//    - "P v Q 2-5 IP"       → Close IP subproof with formula "P v Q", lines 2-5
//    - "2-5 CP"             → Auto-close CP subproof, lines 2-5
//    - "CP" or "IP"         → Auto-close with auto-detected lines
//
// 2. SUBPROOF OPEN (assumption + technique, no line numbers):
//    - "P CP"               → Open CP subproof assuming P
//    - "~Q IP"              → Open IP subproof assuming ~Q
//
// 3. INFERENCE/EQUIVALENCE RULES (comma-separated or space-separated lines):
//    - "Q 1,2 MP"           → Apply MP to lines 1,2, derive Q
//    - "Q 1 2 MP"           → Apply MP to lines 1,2, derive Q
//    - "~~P 3 DN"           → Apply DN to line 3, derive ~~P
//    - "MP 1,2"             → Apply MP to lines 1,2 (auto-derive formula)
//
// 4. LEGACY FORMAT (with //):
//    - "Q //1, 2, MP"       → Apply MP to lines 1,2, derive Q
//    - "P > Q //2-5, CP"    → Close CP subproof
// =============================================================================

// Regex for matching technique abbreviations (CP, IP, ~I, NI)
const TECHNIQUE_PATTERN = /^(cp|ip|~i|ni)$/i;

// Regex for matching line ranges like "2-5" or "2–5" (en-dash)
const LINE_RANGE_PATTERN = /(\d+)\s*[-–]\s*(\d+)/;

// Check if a string is a known rule abbreviation
export function isKnownRule(abbrev: string): 'inference' | 'equivalence' | 'technique' | null {
  const lower = abbrev.toLowerCase();
  if (abbrevToTechnique[lower]) return 'technique';
  if (abbrevToInference[lower]) return 'inference';
  if (abbrevToEquivalence[lower]) return 'equivalence';
  return null;
}

// Parse result types
export interface SubproofCloseResult {
  type: 'subproofClose';
  formula: string | null;
  technique: ProofTechnique;
  lineRange?: { start: number; end: number };
}

export interface SubproofOpenResult {
  type: 'subproofOpen';
  formula: string;
  technique: ProofTechnique;
}

export interface RuleApplicationResult {
  type: 'ruleApplication';
  formula: string;
  lines: number[];
  rule: string;
  ruleType: 'inference' | 'equivalence';
}

export type ParseResult = SubproofCloseResult | SubproofOpenResult | RuleApplicationResult | null;

/**
 * Unified parser for all proof input commands.
 * Returns a typed result indicating what kind of command was parsed.
 */
export function parseCommand(input: string): ParseResult {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Extract the last word (potential rule/technique)
  const lastWordMatch = trimmed.match(/\s+([A-Za-z~]+)$/i);
  const lastWord = lastWordMatch ? lastWordMatch[1] : trimmed;
  const lastWordLower = lastWord.toLowerCase();

  // Check if it's a known rule/technique
  const ruleType = isKnownRule(lastWord);

  // CASE 1: Just a technique name alone (e.g., "CP", "IP")
  if (TECHNIQUE_PATTERN.test(trimmed)) {
    const tech = abbrevToTechnique[trimmed.toLowerCase()];
    if (tech) {
      return { type: 'subproofClose', formula: null, technique: tech };
    }
  }

  // CASE 2: Check for line range pattern (indicates subproof close)
  const rangeMatch = trimmed.match(LINE_RANGE_PATTERN);
  if (rangeMatch && ruleType === 'technique') {
    const technique = abbrevToTechnique[lastWordLower]!;
    const lineStart = parseInt(rangeMatch[1], 10);
    const lineEnd = parseInt(rangeMatch[2], 10);

    // Validate parsed line numbers (including lineStart > lineEnd check)
    if (isNaN(lineStart) || isNaN(lineEnd) || lineStart < 1 || lineEnd < 1 || lineStart > lineEnd) {
      return null;  // Invalid line range
    }

    // Check if there's a formula before the range
    const beforeRange = trimmed.substring(0, rangeMatch.index).trim();
    // Remove any trailing // or whitespace
    const formula = beforeRange.replace(/\s*\/\/\s*$/, '').trim() || null;

    return {
      type: 'subproofClose',
      formula,
      technique,
      lineRange: { start: lineStart, end: lineEnd },
    };
  }

  // CASE 3: Ends with technique, no line range or line numbers → subproof open
  // e.g., "P CP", "~Q IP", "A > B CP"
  if (ruleType === 'technique' && lastWordMatch) {
    const beforeTechnique = trimmed.substring(0, lastWordMatch.index).trim();
    // Remove optional // prefix
    const formula = beforeTechnique.replace(/\s*\/\/\s*$/, '').trim();

    // Make sure there are no digits that look like line numbers
    // Allow digits that are part of atom names (e.g., "P1") but not standalone line refs
    const hasStandaloneDigits = /(?:^|\s)\d+(?:\s|$)/.test(formula);

    if (formula && !hasStandaloneDigits) {
      return {
        type: 'subproofOpen',
        formula,
        technique: abbrevToTechnique[lastWordLower]!,
      };
    }
  }

  // CASE 4: Parse as inference/equivalence rule application
  // Try to extract: FORMULA LINES RULE or RULE LINES FORMULA

  // Format A: "FORMULA LINES RULE" (e.g., "Q 1,2 MP" or "Q 1 2 MP")
  // The lines can be comma-separated or space-separated
  const formatAMatch = trimmed.match(/^(.+?)\s+(\d[\d\s,]*\d|\d)\s+([A-Za-z~]+)$/);
  if (formatAMatch) {
    const formula = formatAMatch[1].trim();
    const linesPart = formatAMatch[2];
    const rule = formatAMatch[3];
    const rType = isKnownRule(rule);

    if (rType === 'inference' || rType === 'equivalence') {
      const lines = linesPart
        .split(/[\s,]+/)
        .map(s => parseInt(s, 10))
        .filter(n => !isNaN(n));

      if (lines.length > 0) {
        return {
          type: 'ruleApplication',
          formula,
          lines,
          rule,
          ruleType: rType,
        };
      }
    }
  }

  // Format B: "RULE LINES [FORMULA]" (e.g., "MP 1,2" or "MP 1,2 Q")
  const formatBMatch = trimmed.match(/^([A-Za-z~]+)\s+(\d[\d\s,]*\d|\d)(?:\s*,?\s*(.*))?$/);
  if (formatBMatch) {
    const rule = formatBMatch[1];
    const linesPart = formatBMatch[2];
    const formula = formatBMatch[3]?.trim() || '';
    const rType = isKnownRule(rule);

    if (rType === 'inference' || rType === 'equivalence') {
      const lines = linesPart
        .split(/[\s,]+/)
        .map(s => parseInt(s, 10))
        .filter(n => !isNaN(n));

      if (lines.length > 0) {
        return {
          type: 'ruleApplication',
          formula,
          lines,
          rule,
          ruleType: rType,
        };
      }
    }
  }

  // Format C: Legacy "FORMULA //LINES, RULE" (e.g., "Q //1, 2, MP")
  const legacyMatch = trimmed.match(/^(.+?)\s*\/\/\s*(.+)$/);
  if (legacyMatch) {
    const formula = legacyMatch[1].trim();
    const rest = legacyMatch[2].trim();

    // Parse the rest as "lines, rule" or "range, technique"
    const parts = rest.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      const rule = parts[parts.length - 1];
      const lineStrs = parts.slice(0, -1);
      const rType = isKnownRule(rule);

      // Check for range format in lines
      const rangeInLegacy = lineStrs.join(',').match(LINE_RANGE_PATTERN);
      if (rangeInLegacy && rType === 'technique') {
        return {
          type: 'subproofClose',
          formula,
          technique: abbrevToTechnique[rule.toLowerCase()]!,
          lineRange: {
            start: parseInt(rangeInLegacy[1], 10),
            end: parseInt(rangeInLegacy[2], 10),
          },
        };
      }

      if (rType === 'inference' || rType === 'equivalence') {
        const lines = lineStrs
          .map(s => parseInt(s, 10))
          .filter(n => !isNaN(n));

        if (lines.length > 0) {
          return {
            type: 'ruleApplication',
            formula,
            lines,
            rule,
            ruleType: rType,
          };
        }
      }
    }
  }

  return null;
}
