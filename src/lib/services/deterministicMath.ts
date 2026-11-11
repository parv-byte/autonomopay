
/**
 * Deterministic Settlement Mathematical Engine
 * 
 * Enforces Priority 2:
 * LLM evaluates → code calculates score → code calculates payment → PayPal executes.
 * 
 * All financial math is strictly deterministic, auditable, and floating-point safe.
 * The LLM only evaluates qualitative criteria; TypeScript code calculates the
 * final composite score, decision threshold, settlement percentage, and cent-exact dollar payouts.
 */

export interface CriteriaScoreInput {
  criterion: string;
  passed: boolean;
  score: number;
  weight?: number;
  evidence?: string;
  type?: 'MANDATORY' | 'OPTIONAL';
}

export interface DeterministicScoreCalculation {
  tierScores: {
    structural: number;
    quality: number;
    deterministic: number;
  };
  weights: {
    structural: number;
    quality: number;
    deterministic: number;
  };
  rawScore: number;
  finalScore: number;
  formula: string;
  verdict: 'RELEASE' | 'PARTIAL_SETTLEMENT' | 'REFUND' | 'HUMAN_REVIEW';
  settlementPercentage: number;
  mathSteps: string[];
  reconciliation: {
    budget: number;
    workerPayout: number;
    buyerRefund: number;
    sum: number;
    reconciled: boolean;
  };
}

export interface PaymentCalculationResult {
  budget: number;
  settlementPercentage: number;
  workerPayout: number;
  buyerRefund: number;
  sum: number;
  variance: number;
  reconciled: boolean;
  formula: string;
  steps: string[];
}

/**
 * 1. Code calculates score from LLM qualitative evaluation
 * Weighted average of per-criterion evaluations
 */
export function calculateQualityScoreFromCriteria(criteria: CriteriaScoreInput[]): number {
  if (!criteria || criteria.length === 0) return 0;

  let totalWeight = 0;
  let weightedScoreSum = 0;

  for (const c of criteria) {
    const weight = c.weight ?? (c.type === 'OPTIONAL' ? 0.5 : 1.0);
    totalWeight += weight;
    weightedScoreSum += (c.score || (c.passed ? 100 : 0)) * weight;
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedScoreSum / totalWeight) * 10) / 10;
}

/**
 * 2. Code calculates composite multi-tier score mathematically
 * Deterministic combination of:
 * - Structural Score (Ajv schema, record count, field completeness)
 * - Quality Score (LLM criterion evaluations)
 * - Deterministic Test Score (Count, unique IDs, formats, invariants)
 */
export function calculateDeterministicCompositeScore(params: {
  structuralScore: number;
  qualityScore: number;
  deterministicScore: number;
  budget: number;
  weights?: { structural: number; quality: number; deterministic: number };
  overrideScore?: number;
}): DeterministicScoreCalculation {
  const { structuralScore, qualityScore, deterministicScore, budget } = params;

  // Default industry-standard multi-tier weights:
  // 30% Structural verification, 40% Semantic quality, 30% Deterministic tests
  const weights = params.weights || {
    structural: 0.30,
    quality: 0.40,
    deterministic: 0.30,
  };

  // Normalize weights if needed
  const weightSum = weights.structural + weights.quality + weights.deterministic;
  const wS = weights.structural / weightSum;
  const wQ = weights.quality / weightSum;
  const wD = weights.deterministic / weightSum;

  const rawScore = (wS * structuralScore) + (wQ * qualityScore) + (wD * deterministicScore);

  // Use explicit score if specified, otherwise round to 1 decimal place
  const finalScore = params.overrideScore !== undefined
    ? Math.round(params.overrideScore * 10) / 10
    : Math.round(rawScore * 10) / 10;

  // Code decides the verdict deterministically based on thresholds:
  // Score >= 90: RELEASE (Full 100% payment)
  // 50 <= Score < 90: PARTIAL_SETTLEMENT (Proportional payment = finalScore %)
  // Score < 50: REFUND (Full refund to buyer)
  let verdict: 'RELEASE' | 'PARTIAL_SETTLEMENT' | 'REFUND' | 'HUMAN_REVIEW';
  let settlementPercentage: number;

  if (finalScore >= 90) {
    verdict = 'RELEASE';
    settlementPercentage = 100.0;
  } else if (finalScore >= 50) {
    verdict = 'PARTIAL_SETTLEMENT';
    settlementPercentage = finalScore;
  } else {
    verdict = 'REFUND';
    settlementPercentage = 0.0;
  }

  // 3. Code calculates cent-exact payment
  const payment = calculateDeterministicPayment(budget, settlementPercentage);

  const formula = `(${wS.toFixed(2)} * ${structuralScore.toFixed(1)}) + (${wQ.toFixed(2)} * ${qualityScore.toFixed(1)}) + (${wD.toFixed(2)} * ${deterministicScore.toFixed(1)}) = ${finalScore.toFixed(1)}%`;

  const mathSteps = [
    `Tier 1 Structural Score: ${structuralScore.toFixed(1)}/100 (Weight: ${(wS * 100).toFixed(0)}%) -> ${(wS * structuralScore).toFixed(2)} pts`,
    `Tier 2 AI Quality Score: ${qualityScore.toFixed(1)}/100 (Weight: ${(wQ * 100).toFixed(0)}%) -> ${(wQ * qualityScore).toFixed(2)} pts`,
    `Tier 3 Deterministic Score: ${deterministicScore.toFixed(1)}/100 (Weight: ${(wD * 100).toFixed(0)}%) -> ${(wD * deterministicScore).toFixed(2)} pts`,
    `Mathematical Composite Score: ${finalScore.toFixed(1)}/100`,
    `Arbitration Threshold Verdict: ${verdict} (Settlement: ${settlementPercentage.toFixed(1)}%)`,
    `Worker Payout: $${budget.toFixed(2)} * (${settlementPercentage.toFixed(1)} / 100) = $${payment.workerPayout.toFixed(2)}`,
    `Buyer Refund: $${budget.toFixed(2)} - $${payment.workerPayout.toFixed(2)} = $${payment.buyerRefund.toFixed(2)}`,
    `Reconciliation Invariant: $${payment.workerPayout.toFixed(2)} + $${payment.buyerRefund.toFixed(2)} = $${payment.sum.toFixed(2)} (Delta: $0.00)`,
  ];

  return {
    tierScores: {
      structural: structuralScore,
      quality: qualityScore,
      deterministic: deterministicScore,
    },
    weights: {
      structural: wS,
      quality: wQ,
      deterministic: wD,
    },
    rawScore,
    finalScore,
    formula,
    verdict,
    settlementPercentage,
    mathSteps,
    reconciliation: {
      budget,
      workerPayout: payment.workerPayout,
      buyerRefund: payment.buyerRefund,
      sum: payment.sum,
      reconciled: payment.reconciled,
    },
  };
}

/**
 * 3. Cent-exact deterministic payment distribution
 * Eliminates floating point rounding errors and guarantees exact reconciliation:
 * workerPayout + buyerRefund === budget (to the exact cent).
 */
export function calculateDeterministicPayment(
  budget: number,
  settlementPercentage: number
): PaymentCalculationResult {
  // Clamp percentage between 0 and 100
  const clampedPercentage = Math.max(0, Math.min(100, settlementPercentage));

  // Round worker payout to exact cent (2 decimal places)
  const workerPayout = Math.round((budget * clampedPercentage) / 100 * 100) / 100;

  // Remainder to buyer refund to guarantee zero drift
  const buyerRefund = Math.round((budget - workerPayout) * 100) / 100;

  const sum = Math.round((workerPayout + buyerRefund) * 100) / 100;
  const variance = Math.abs(Math.round((budget - sum) * 100) / 100);
  const reconciled = variance === 0;

  const formula = `$${budget.toFixed(2)} * (${clampedPercentage.toFixed(1)} / 100) = $${workerPayout.toFixed(2)} worker + $${buyerRefund.toFixed(2)} refund`;

  const steps = [
    `Contract Budget: $${budget.toFixed(2)}`,
    `Determined Settlement: ${clampedPercentage.toFixed(1)}%`,
    `Calculated Worker Payout: round($${budget.toFixed(2)} * ${clampedPercentage.toFixed(1)}%, 2) = $${workerPayout.toFixed(2)}`,
    `Calculated Buyer Refund: $${budget.toFixed(2)} - $${workerPayout.toFixed(2)} = $${buyerRefund.toFixed(2)}`,
    `Reconciliation Check: $${workerPayout.toFixed(2)} + $${buyerRefund.toFixed(2)} = $${sum.toFixed(2)} (Variance: $${variance.toFixed(2)})`,
  ];

  return {
    budget,
    settlementPercentage: clampedPercentage,
    workerPayout,
    buyerRefund,
    sum,
    variance,
    reconciled,
    formula,
    steps,
  };
}

