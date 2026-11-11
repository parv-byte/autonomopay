/**
 * Verification Engine
 * 
 * Three-stage verification pipeline:
 * 1. Structural Validator - deterministic checks
 * 2. Task Quality Evaluator - AI-powered evaluation
 * 3. Deterministic Tests - code-based validation
 * 
 * Plus AI Arbitrator for final decision.
 */

import Ajv from 'ajv';
import { evaluateDeliverable, arbitrate, type VerificationEvaluation, type ArbitrationResult } from './aiService';
import { calculateDeterministicCompositeScore, type DeterministicScoreCalculation } from './deterministicMath';

// Expected schema for PDF extraction deliverable
const pdfExtractionSchema = {
  type: 'object',
  properties: {
    records: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: ['string', 'number'] },
          title: { type: 'string' },
          author: { type: 'string' },
          date: { type: 'string' },
          abstract: { type: 'string' },
          keywords: { type: 'array', items: { type: 'string' } },
          doi: { type: 'string' },
        },
        required: ['title', 'author', 'date', 'abstract'],
      },
    },
    metadata: {
      type: 'object',
      properties: {
        totalProcessed: { type: 'number' },
        processingTime: { type: 'string' },
        accuracy: { type: 'number' },
      },
    },
  },
  required: ['records'],
};

export interface StructuralValidationResult {
  score: number;
  passed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    expected: string;
    actual: string;
    details: string;
  }>;
  details: string;
}

export interface DeterministicTestResult {
  score: number;
  passed: boolean;
  tests: Array<{
    name: string;
    passed: boolean;
    expected: string;
    actual: string;
  }>;
  details: string;
}

export interface FullVerificationResult {
  structural: StructuralValidationResult;
  quality: VerificationEvaluation;
  deterministic: DeterministicTestResult;
  arbitration: ArbitrationResult;
  mathCalculation: DeterministicScoreCalculation;
  overall: {
    score: number;
    decision: string;
    settlementPercentage: number;
    settlementAmount: number;
    refundAmount: number;
    explanation: string;
    formula: string;
    mathSteps: string[];
    reconciliation: {
      budget: number;
      workerPayout: number;
      buyerRefund: number;
      sum: number;
      reconciled: boolean;
    };
  };
}

/**
 * Verifier 1 — Structural Validator
 * Pure code-based checks, no AI involved
 */
export function runStructuralValidation(
  deliverableJson: string,
  expectedRecordCount: number = 500,
  requiredFields: string[] = ['title', 'author', 'date', 'abstract', 'keywords', 'doi']
): StructuralValidationResult {
  const checks: StructuralValidationResult['checks'] = [];
  let totalScore = 0;
  let totalChecks = 0;

  // Check 1: Valid JSON
  let parsedData: Record<string, unknown>;
  try {
    parsedData = JSON.parse(deliverableJson);
    checks.push({
      name: 'Valid JSON',
      passed: true,
      expected: 'Valid JSON document',
      actual: 'Valid JSON',
      details: 'Deliverable is valid JSON',
    });
    totalScore += 100;
  } catch {
    checks.push({
      name: 'Valid JSON',
      passed: false,
      expected: 'Valid JSON document',
      actual: 'Invalid JSON',
      details: 'Deliverable is not valid JSON',
    });
    totalChecks++;
    return {
      score: 0,
      passed: false,
      checks,
      details: 'Deliverable is not valid JSON. Cannot proceed with further validation.',
    };
  }
  totalChecks++;

  // Check 2: JSON Schema Validation
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(pdfExtractionSchema);
  const schemaValid = validate(parsedData);
  checks.push({
    name: 'JSON Schema',
    passed: !!schemaValid,
    expected: 'Conforms to PDF extraction schema',
    actual: schemaValid ? 'Valid schema' : `Schema errors: ${ajv.errorsText(validate.errors)}`,
    details: schemaValid ? 'Schema validation passed' : `Schema errors found: ${ajv.errorsText(validate.errors)}`,
  });
  totalScore += schemaValid ? 100 : 0;
  totalChecks++;

  // Check 3: Records exist
  const records = (parsedData as { records?: unknown[] }).records;
  const hasRecords = Array.isArray(records) && records.length > 0;
  checks.push({
    name: 'Records Present',
    passed: hasRecords,
    expected: `Array of ${expectedRecordCount} records`,
    actual: hasRecords ? `${records!.length} records found` : 'No records array found',
    details: hasRecords ? `Found ${records!.length} records` : 'Missing records array',
  });
  totalScore += hasRecords ? 100 : 0;
  totalChecks++;

  // Check 4: Record count
  if (hasRecords) {
    const countMatch = records!.length >= expectedRecordCount;
    const countScore = Math.min(100, (records!.length / expectedRecordCount) * 100);
    checks.push({
      name: 'Record Count',
      passed: countMatch,
      expected: `${expectedRecordCount} records`,
      actual: `${records!.length} records`,
      details: countMatch
        ? `All ${expectedRecordCount} records present`
        : `Only ${records!.length}/${expectedRecordCount} records (${((records!.length / expectedRecordCount) * 100).toFixed(1)}%)`,
    });
    totalScore += countScore;
    totalChecks++;

    // Check 5: Required fields
    let fieldsPresent = 0;
    let fieldsTotal = 0;
    for (const record of records! as Record<string, unknown>[]) {
      for (const field of requiredFields) {
        fieldsTotal++;
        if (record[field] !== undefined && record[field] !== null && record[field] !== '') {
          fieldsPresent++;
        }
      }
    }
    const fieldScore = fieldsTotal > 0 ? (fieldsPresent / fieldsTotal) * 100 : 0;
    const missingPercent = fieldsTotal > 0 ? ((fieldsTotal - fieldsPresent) / fieldsTotal) * 100 : 100;
    checks.push({
      name: 'Required Fields',
      passed: missingPercent < 5,
      expected: `All required fields present (${requiredFields.join(', ')})`,
      actual: `${fieldsPresent}/${fieldsTotal} field values present (${missingPercent.toFixed(1)}% missing)`,
      details: `Field completeness: ${fieldScore.toFixed(1)}%`,
    });
    totalScore += fieldScore;
    totalChecks++;

    // Check 6: No empty records
    const emptyRecords = (records! as Record<string, unknown>[]).filter(
      r => Object.values(r).every(v => v === null || v === undefined || v === '')
    ).length;
    checks.push({
      name: 'No Empty Records',
      passed: emptyRecords === 0,
      expected: 'No completely empty records',
      actual: emptyRecords === 0 ? 'No empty records' : `${emptyRecords} empty records found`,
      details: emptyRecords === 0 ? 'All records contain data' : `${emptyRecords} records are completely empty`,
    });
    totalScore += emptyRecords === 0 ? 100 : Math.max(0, 100 - (emptyRecords / records!.length) * 100);
    totalChecks++;
  }

  const finalScore = totalChecks > 0 ? Math.round(totalScore / totalChecks) : 0;

  return {
    score: finalScore,
    passed: finalScore >= 90,
    checks,
    details: checks.map(c => `${c.passed ? '✓' : '✗'} ${c.name}: ${c.details}`).join('\n'),
  };
}

/**
 * Verifier 3 — Deterministic Tests
 * Actual code-based tests, no AI
 */
export function runDeterministicTests(
  deliverableJson: string,
  expectedRecordCount: number = 500,
  accuracyThreshold: number = 95
): DeterministicTestResult {
  const tests: DeterministicTestResult['tests'] = [];
  let passedCount = 0;

  // Parse deliverable
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(deliverableJson);
  } catch {
    return {
      score: 0,
      passed: false,
      tests: [{ name: 'JSON Parse', passed: false, expected: 'Valid JSON', actual: 'Parse Error' }],
      details: 'Cannot parse deliverable JSON',
    };
  }

  const records = (data as { records?: unknown[] }).records as Record<string, unknown>[] | undefined;
  const metadata = (data as { metadata?: Record<string, unknown> }).metadata;

  // Test 1: Record count validation
  const recordCount = Array.isArray(records) ? records.length : 0;
  const countPass = recordCount >= expectedRecordCount;
  tests.push({
    name: 'Record Count',
    passed: countPass,
    expected: `>= ${expectedRecordCount}`,
    actual: `${recordCount}`,
  });
  if (countPass) passedCount++;

  // Test 2: No duplicate IDs
  if (records) {
    const ids = records.map(r => r.id).filter(Boolean);
    const uniqueIds = new Set(ids);
    const noDupes = ids.length === 0 || uniqueIds.size === ids.length;
    tests.push({
      name: 'No Duplicate IDs',
      passed: noDupes,
      expected: 'All unique IDs',
      actual: noDupes ? 'All unique' : `${ids.length - uniqueIds.size} duplicates found`,
    });
    if (noDupes) passedCount++;
  }

  // Test 3: Title not empty
  if (records) {
    const emptyTitles = records.filter(r => !r.title || (typeof r.title === 'string' && r.title.trim() === '')).length;
    const titlePass = emptyTitles === 0;
    tests.push({
      name: 'Non-empty Titles',
      passed: titlePass,
      expected: 'All records have titles',
      actual: titlePass ? 'All titles present' : `${emptyTitles} empty titles`,
    });
    if (titlePass) passedCount++;
  }

  // Test 4: Valid date formats
  if (records) {
    const invalidDates = records.filter(r => {
      if (!r.date) return true;
      const d = new Date(r.date as string);
      return isNaN(d.getTime());
    }).length;
    const datePass = invalidDates === 0;
    tests.push({
      name: 'Valid Dates',
      passed: datePass,
      expected: 'All valid date formats',
      actual: datePass ? 'All dates valid' : `${invalidDates} invalid dates`,
    });
    if (datePass) passedCount++;
  }

  // Test 5: Keywords are arrays
  if (records) {
    const invalidKeywords = records.filter(r => r.keywords && !Array.isArray(r.keywords)).length;
    const keywordsPass = invalidKeywords === 0;
    tests.push({
      name: 'Keywords Format',
      passed: keywordsPass,
      expected: 'Keywords as arrays',
      actual: keywordsPass ? 'All arrays' : `${invalidKeywords} non-array keywords`,
    });
    if (keywordsPass) passedCount++;
  }

  // Test 6: Accuracy from metadata
  if (metadata && typeof metadata.accuracy === 'number') {
    const accuracyPass = metadata.accuracy >= accuracyThreshold;
    tests.push({
      name: 'Accuracy Threshold',
      passed: accuracyPass,
      expected: `>= ${accuracyThreshold}%`,
      actual: `${metadata.accuracy}%`,
    });
    if (accuracyPass) passedCount++;
  }

  // Test 7: DOI format validation
  if (records) {
    const invalidDois = records.filter(r => {
      if (!r.doi) return false; // DOI can be optional
      return typeof r.doi !== 'string' || !r.doi.toString().startsWith('10.');
    }).length;
    const doiPass = invalidDois === 0;
    tests.push({
      name: 'DOI Format',
      passed: doiPass,
      expected: 'Valid DOI format (10.xxxx/...)',
      actual: doiPass ? 'All DOIs valid' : `${invalidDois} invalid DOIs`,
    });
    if (doiPass) passedCount++;
  }

  // Test 8: Abstract min length
  if (records) {
    const shortAbstracts = records.filter(r => {
      if (!r.abstract) return true;
      return typeof r.abstract === 'string' && r.abstract.length < 20;
    }).length;
    const abstractPass = shortAbstracts < records.length * 0.1; // Allow 10% short
    tests.push({
      name: 'Abstract Quality',
      passed: abstractPass,
      expected: 'Abstracts >= 20 characters',
      actual: abstractPass ? 'Adequate abstracts' : `${shortAbstracts} too-short abstracts`,
    });
    if (abstractPass) passedCount++;
  }

  const score = tests.length > 0 ? Math.round((passedCount / tests.length) * 100) : 0;

  return {
    score,
    passed: score >= 80,
    tests,
    details: tests.map(t => `${t.passed ? '✓' : '✗'} ${t.name}: expected ${t.expected}, got ${t.actual}`).join('\n'),
  };
}

/**
 * Run the full verification pipeline
 */
export async function runFullVerification(
  contract: {
    task: string;
    budget: number;
    acceptanceCriteria: string[];
    expectedRecordCount?: number;
    accuracyThreshold?: number;
  },
  deliverableJson: string
): Promise<FullVerificationResult> {
  const expectedRecords = contract.expectedRecordCount || 500;
  const accuracyThreshold = contract.accuracyThreshold || 95;

  // Stage 1: Structural Validation
  const structural = runStructuralValidation(deliverableJson, expectedRecords);

  // Stage 2: AI Quality Evaluation
  const quality = await evaluateDeliverable(
    {
      task: contract.task,
      acceptanceCriteria: contract.acceptanceCriteria,
      budget: contract.budget,
    },
    deliverableJson
  );

  // Stage 3: Deterministic Tests
  const deterministic = runDeterministicTests(deliverableJson, expectedRecords, accuracyThreshold);

  // Stage 4: AI Arbitration (LLM qualitative synthesis)
  const arbitration = await arbitrate(
    contract,
    { score: structural.score, details: structural.details },
    quality,
    { score: deterministic.score, details: deterministic.details }
  );

  // Stage 5: Code Calculates Score & Payment (Mathematically Deterministic Engine)
  // Check if deliverable contains reported accuracy metadata
  let deliverableAccuracy: number | undefined;
  try {
    const parsedData = JSON.parse(deliverableJson);
    if (typeof parsedData.metadata?.accuracy === 'number') {
      deliverableAccuracy = parsedData.metadata.accuracy;
    }
  } catch {
    // Ignore JSON parse errors
  }

  // Code calculates score & cent-exact payment
  const mathCalculation = calculateDeterministicCompositeScore({
    structuralScore: structural.score,
    qualityScore: quality.score,
    deterministicScore: deterministic.score,
    budget: contract.budget,
    overrideScore: (deliverableAccuracy !== undefined && deliverableAccuracy < 90) ? deliverableAccuracy : undefined,
  });

  // Sync arbitration with the deterministic mathematical calculation
  arbitration.finalScore = mathCalculation.finalScore;
  arbitration.decision = mathCalculation.verdict;
  arbitration.settlementPercentage = mathCalculation.settlementPercentage;

  const settlementPercentage = mathCalculation.settlementPercentage;
  const settlementAmount = mathCalculation.reconciliation.workerPayout;
  const refundAmount = mathCalculation.reconciliation.buyerRefund;

  // Build human-readable explanation
  const explanation = buildExplanation(
    structural,
    quality,
    deterministic,
    arbitration,
    contract.budget,
    settlementAmount,
    refundAmount,
    mathCalculation
  );

  return {
    structural,
    quality,
    deterministic,
    arbitration,
    mathCalculation,
    overall: {
      score: mathCalculation.finalScore,
      decision: mathCalculation.verdict,
      settlementPercentage,
      settlementAmount,
      refundAmount,
      explanation,
      formula: mathCalculation.formula,
      mathSteps: mathCalculation.mathSteps,
      reconciliation: mathCalculation.reconciliation,
    },
  };
}

/**
 * Build a detailed human-readable explanation
 */
function buildExplanation(
  structural: StructuralValidationResult,
  quality: VerificationEvaluation,
  deterministic: DeterministicTestResult,
  arbitration: ArbitrationResult,
  budget: number,
  settlement: number,
  refund: number,
  mathCalculation?: DeterministicScoreCalculation
): string {
  const parts: string[] = [];

  if (arbitration.decision === 'RELEASE') {
    parts.push(
      `Payment released because ${quality.criteria.filter(c => c.passed).length}/${quality.criteria.length} mandatory criteria passed.`
    );
    parts.push(
      `The deliverable achieved a structural score of ${structural.score}/100, ` +
      `quality score of ${quality.score}/100, and deterministic test score of ${deterministic.score}/100.`
    );
    parts.push(
      `Final arbitration score: ${arbitration.finalScore}/100. Full payment of $${budget.toFixed(2)} released to worker.`
    );
  } else if (arbitration.decision === 'PARTIAL_SETTLEMENT') {
    parts.push(
      `Partial settlement recommended. ${quality.criteria.filter(c => !c.passed).length} acceptance criteria were not met.`
    );
    if (quality.issues.length > 0) {
      parts.push(`Issues identified: ${quality.issues.join('; ')}`);
    }
    parts.push(
      `Based on overall quality (${arbitration.finalScore}/100), settlement calculated at ${arbitration.settlementPercentage}%: ` +
      `$${settlement.toFixed(2)} to worker, $${refund.toFixed(2)} refunded to buyer.`
    );
  } else if (arbitration.decision === 'REFUND') {
    parts.push(
      `Full refund recommended. The deliverable failed to meet minimum quality standards (score: ${arbitration.finalScore}/100).`
    );
    parts.push(`Full refund of $${budget.toFixed(2)} to buyer.`);
  } else {
    parts.push(
      `Escalated to human review. The AI arbitrator could not reach a confident decision (score: ${arbitration.finalScore}/100).`
    );
  }

  if (mathCalculation) {
    parts.push(`\nDeterministic Formula: ${mathCalculation.formula}`);
    parts.push(`Math Proof: Worker $${settlement.toFixed(2)} + Buyer $${refund.toFixed(2)} = $${budget.toFixed(2)} (Zero Variance).`);
  }

  parts.push(`\nDetailed reasoning: ${arbitration.reasoning}`);

  return parts.join(' ');
}
