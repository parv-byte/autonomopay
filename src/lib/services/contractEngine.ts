/**
 * Contract Engine
 * 
 * Manages the full lifecycle of contracts including:
 * - Creation from natural language
 * - Funding through PayPal
 * - Deliverable submission
 * - Verification orchestration
 * - Settlement/refund execution
 * - Audit trail
 */

import prisma from '@/lib/prisma';
import { parseContract } from './aiService';
import { createAuthorization, capturePayment, refundPayment, createPayout } from './paypalService';
import { runFullVerification, type FullVerificationResult } from './verificationEngine';
import { v4 as uuid } from 'uuid';

// Payment state machine transitions
const VALID_PAYMENT_TRANSITIONS: Record<string, string[]> = {
  CREATED: ['AUTHORIZED'],
  AUTHORIZED: ['VERIFICATION_PENDING', 'REFUNDED', 'DISPUTED'],
  VERIFICATION_PENDING: ['APPROVED', 'PARTIALLY_SETTLED', 'REFUNDED', 'HUMAN_REVIEW', 'DISPUTED'],
  APPROVED: ['CAPTURED'],
  CAPTURED: ['PARTIALLY_SETTLED', 'REFUNDED'],
  PARTIALLY_SETTLED: ['DISPUTED'],
  REFUNDED: [],
  DISPUTED: ['HUMAN_REVIEW', 'PARTIALLY_SETTLED', 'REFUNDED'],
  HUMAN_REVIEW: ['PARTIALLY_SETTLED', 'REFUNDED', 'CAPTURED'],
};

// Contract state machine transitions
const VALID_CONTRACT_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['FUNDED', 'CANCELLED'],
  FUNDED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['DELIVERABLE_SUBMITTED'],
  DELIVERABLE_SUBMITTED: ['VERIFICATION_PENDING'],
  VERIFICATION_PENDING: ['VERIFIED'],
  VERIFIED: ['SETTLED', 'PARTIALLY_SETTLED', 'REFUNDED', 'DISPUTED', 'HUMAN_REVIEW'],
  SETTLED: ['COMPLETED'],
  PARTIALLY_SETTLED: ['COMPLETED', 'DISPUTED'],
  REFUNDED: ['COMPLETED'],
  DISPUTED: ['HUMAN_REVIEW', 'PARTIALLY_SETTLED', 'REFUNDED', 'SETTLED'],
  HUMAN_REVIEW: ['SETTLED', 'PARTIALLY_SETTLED', 'REFUNDED'],
  COMPLETED: [],
  CANCELLED: [],
};

async function createAuditEvent(
  event: string,
  actor: string,
  actorType: string,
  contractId?: string,
  paymentId?: string,
  agentId?: string,
  result?: string,
  metadata?: Record<string, unknown>
) {
  return prisma.auditEvent.create({
    data: {
      id: uuid(),
      event,
      actor,
      actorType,
      contractId,
      paymentId,
      agentId,
      result,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

function validateTransition(currentState: string, newState: string, transitions: Record<string, string[]>): boolean {
  return transitions[currentState]?.includes(newState) || false;
}

/**
 * Create a contract from natural language input
 */
export async function createContractFromNL(
  userId: string,
  buyerAgentId: string,
  naturalLanguageInput: string
) {
  // Parse with AI
  const parsed = await parseContract(naturalLanguageInput);

  // Create contract
  const contract = await prisma.contract.create({
    data: {
      id: uuid(),
      title: parsed.task.substring(0, 100),
      description: parsed.task,
      task: parsed.task,
      deliverableType: parsed.deliverable,
      deadline: parsed.deadline ? new Date(Date.now() + parseDeadline(parsed.deadline)) : null,
      budget: parsed.budget,
      currency: parsed.currency,
      status: 'DRAFT',
      rawInput: naturalLanguageInput,
      parsedContract: JSON.stringify(parsed),
      creatorId: userId,
      buyerAgentId: buyerAgentId,
    },
  });

  // Create acceptance criteria
  for (const criterion of parsed.acceptanceCriteria) {
    await prisma.acceptanceCriterion.create({
      data: {
        id: uuid(),
        criterion,
        type: 'MANDATORY',
        weight: 1.0,
        contractId: contract.id,
      },
    });
  }

  // Create milestones
  for (let i = 0; i < parsed.milestones.length; i++) {
    await prisma.milestone.create({
      data: {
        id: uuid(),
        title: parsed.milestones[i].title,
        description: parsed.milestones[i].description,
        status: 'PENDING',
        order: i + 1,
        contractId: contract.id,
      },
    });
  }

  await createAuditEvent(
    'CONTRACT_CREATED',
    buyerAgentId,
    'AGENT',
    contract.id,
    undefined,
    buyerAgentId,
    'Contract created from natural language input',
    { rawInput: naturalLanguageInput.substring(0, 200), budget: parsed.budget }
  );

  return contract;
}

/**
 * Fund a contract through PayPal
 */
export async function fundContract(contractId: string, userId: string) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { payment: true },
  });

  if (!contract) throw new Error('Contract not found');
  if (contract.payment) throw new Error('Contract already has a payment');
  if (contract.status !== 'DRAFT') throw new Error(`Cannot fund contract in ${contract.status} state`);

  const idempotencyKey = uuid();

  // Create PayPal authorization
  const paypalResult = await createAuthorization(
    contract.budget,
    contract.currency,
    `AutonomoPay Contract: ${contract.title}`,
    idempotencyKey
  );

  if (!paypalResult.success) {
    throw new Error(`Payment failed: ${paypalResult.error}`);
  }

  // Create payment record
  const payment = await prisma.payment.create({
    data: {
      id: uuid(),
      amount: contract.budget,
      currency: contract.currency,
      status: 'AUTHORIZED',
      paypalOrderId: paypalResult.orderId,
      paypalDebugId: paypalResult.debugId,
      paypalStatus: 'AUTHORIZED',
      isSimulated: paypalResult.isSimulated,
      rawPaypalResponse: paypalResult.rawResponse ? JSON.stringify(paypalResult.rawResponse) : null,
      contractId: contract.id,
      userId,
      idempotencyKey,
    },
  });

  // Update contract status
  await prisma.contract.update({
    where: { id: contractId },
    data: { status: 'FUNDED' },
  });

  await createAuditEvent(
    'PAYMENT_AUTHORIZED',
    'BUYER_AGENT',
    'AGENT',
    contractId,
    payment.id,
    contract.buyerAgentId,
    `$${contract.budget.toFixed(2)} authorized in PayPal Sandbox [Order ID: ${paypalResult.orderId}]${paypalResult.isSimulated ? ' (simulated)' : ''}`,
    {
      paypalOrderId: paypalResult.orderId,
      paypalDebugId: paypalResult.debugId,
      isSimulated: paypalResult.isSimulated,
      receiptUrl: paypalResult.receiptUrl,
    }
  );

  return { contract: { ...contract, status: 'FUNDED' }, payment };
}

/**
 * Assign worker agent and accept contract
 */
export async function acceptContract(contractId: string, workerAgentId: string) {
  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract) throw new Error('Contract not found');
  if (contract.status !== 'FUNDED') throw new Error(`Cannot accept contract in ${contract.status} state`);

  await prisma.contract.update({
    where: { id: contractId },
    data: { workerAgentId, status: 'IN_PROGRESS' },
  });

  await createAuditEvent(
    'TASK_ACCEPTED',
    workerAgentId,
    'AGENT',
    contractId,
    undefined,
    workerAgentId,
    'Worker agent accepted the contract'
  );

  return { ...contract, workerAgentId, status: 'IN_PROGRESS' };
}

/**
 * Submit a deliverable
 */
export async function submitDeliverable(
  contractId: string,
  agentId: string,
  content: string,
  metadata?: Record<string, unknown>
) {
  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract) throw new Error('Contract not found');
  if (contract.status !== 'IN_PROGRESS') {
    throw new Error(`Cannot submit deliverable in ${contract.status} state`);
  }

  const deliverable = await prisma.deliverable.create({
    data: {
      id: uuid(),
      content,
      metadata: metadata ? JSON.stringify(metadata) : null,
      status: 'SUBMITTED',
      agentId,
      contractId,
    },
  });

  await prisma.contract.update({
    where: { id: contractId },
    data: { status: 'DELIVERABLE_SUBMITTED' },
  });

  await createAuditEvent(
    'DELIVERABLE_SUBMITTED',
    agentId,
    'AGENT',
    contractId,
    undefined,
    agentId,
    'Deliverable submitted for verification',
    { deliverableId: deliverable.id }
  );

  return deliverable;
}

/**
 * Run verification pipeline on a deliverable
 */
export async function verifyDeliverable(contractId: string): Promise<FullVerificationResult> {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      deliverables: { orderBy: { createdAt: 'desc' }, take: 1 },
      acceptanceCriteria: true,
      payment: true,
    },
  });

  if (!contract) throw new Error('Contract not found');
  if (!contract.deliverables[0]) throw new Error('No deliverable found');

  const deliverable = contract.deliverables[0];

  // Update contract status
  await prisma.contract.update({
    where: { id: contractId },
    data: { status: 'VERIFICATION_PENDING' },
  });

  // Update payment status
  if (contract.payment) {
    await prisma.payment.update({
      where: { id: contract.payment.id },
      data: { status: 'VERIFICATION_PENDING' },
    });
  }

  await createAuditEvent(
    'VERIFICATION_STARTED',
    'VERIFIER_AGENT',
    'AGENT',
    contractId,
    contract.payment?.id,
    undefined,
    'Verification pipeline started'
  );

  // Run full verification
  const criteria = contract.acceptanceCriteria.map(c => c.criterion);
  const result = await runFullVerification(
    {
      task: contract.task,
      budget: contract.budget,
      acceptanceCriteria: criteria,
    },
    deliverable.content
  );

  // Store verification runs
  const structuralRun = await prisma.verificationRun.create({
    data: {
      id: uuid(),
      type: 'STRUCTURAL',
      status: 'COMPLETED',
      score: result.structural.score,
      recommendation: result.structural.passed ? 'PASS' : 'FAIL',
      reasoning: result.structural.details,
      rawResult: JSON.stringify(result.structural),
      contractId,
      deliverableId: deliverable.id,
      completedAt: new Date(),
    },
  });

  // Store structural check results
  for (const check of result.structural.checks) {
    await prisma.verificationResult.create({
      data: {
        id: uuid(),
        passed: check.passed,
        score: check.passed ? 100 : 0,
        evidence: check.details,
        details: JSON.stringify(check),
        verificationRunId: structuralRun.id,
      },
    });
  }

  await createAuditEvent(
    'STRUCTURAL_CHECK',
    'VERIFIER_AGENT',
    'AGENT',
    contractId,
    undefined,
    undefined,
    `Score: ${result.structural.score}/100`,
    { score: result.structural.score, passed: result.structural.passed }
  );

  const qualityRun = await prisma.verificationRun.create({
    data: {
      id: uuid(),
      type: 'QUALITY',
      status: 'COMPLETED',
      score: result.quality.score,
      recommendation: result.quality.recommendation,
      reasoning: result.quality.reasoning,
      rawResult: JSON.stringify(result.quality),
      contractId,
      deliverableId: deliverable.id,
      completedAt: new Date(),
    },
  });

  for (const criterion of result.quality.criteria) {
    const matchingCriterion = contract.acceptanceCriteria.find(
      c => c.criterion.toLowerCase().includes(criterion.criterion.toLowerCase().substring(0, 20))
    );
    await prisma.verificationResult.create({
      data: {
        id: uuid(),
        criterionId: matchingCriterion?.id,
        passed: criterion.passed,
        score: criterion.score,
        evidence: criterion.evidence,
        details: JSON.stringify(criterion),
        verificationRunId: qualityRun.id,
      },
    });
  }

  await createAuditEvent(
    'QUALITY_CHECK',
    'VERIFIER_AGENT',
    'AGENT',
    contractId,
    undefined,
    undefined,
    `Score: ${result.quality.score}/100 - ${result.quality.recommendation}`,
    { score: result.quality.score, recommendation: result.quality.recommendation }
  );

  const deterministicRun = await prisma.verificationRun.create({
    data: {
      id: uuid(),
      type: 'DETERMINISTIC',
      status: 'COMPLETED',
      score: result.deterministic.score,
      recommendation: result.deterministic.passed ? 'PASS' : 'FAIL',
      reasoning: result.deterministic.details,
      rawResult: JSON.stringify(result.deterministic),
      contractId,
      deliverableId: deliverable.id,
      completedAt: new Date(),
    },
  });

  for (const test of result.deterministic.tests) {
    await prisma.verificationResult.create({
      data: {
        id: uuid(),
        passed: test.passed,
        score: test.passed ? 100 : 0,
        evidence: `Expected: ${test.expected}, Actual: ${test.actual}`,
        details: JSON.stringify(test),
        verificationRunId: deterministicRun.id,
      },
    });
  }

  await createAuditEvent(
    'DETERMINISTIC_CHECK',
    'VERIFIER_AGENT',
    'AGENT',
    contractId,
    undefined,
    undefined,
    `Score: ${result.deterministic.score}/100`,
    { score: result.deterministic.score, passed: result.deterministic.passed }
  );

  // Store arbitration
  await prisma.verificationRun.create({
    data: {
      id: uuid(),
      type: 'ARBITRATION',
      status: 'COMPLETED',
      score: result.arbitration.finalScore,
      recommendation: result.arbitration.decision,
      reasoning: result.arbitration.reasoning,
      rawResult: JSON.stringify(result.arbitration),
      contractId,
      deliverableId: deliverable.id,
      completedAt: new Date(),
    },
  });

  await createAuditEvent(
    'ARBITRATION_DECISION',
    'ARBITRATOR_AGENT',
    'AGENT',
    contractId,
    contract.payment?.id,
    undefined,
    `Decision: ${result.arbitration.decision} (Score: ${result.arbitration.finalScore}/100)`,
    {
      decision: result.arbitration.decision,
      score: result.arbitration.finalScore,
      settlementPercentage: result.arbitration.settlementPercentage,
    }
  );

  // Update contract status to VERIFIED
  await prisma.contract.update({
    where: { id: contractId },
    data: { status: 'VERIFIED' },
  });

  return result;
}

/**
 * Settle a contract based on verification results
 */
export async function settleContract(contractId: string) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      payment: true,
      verificationRuns: {
        where: { type: 'ARBITRATION' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!contract) throw new Error('Contract not found');
  if (!contract.payment) throw new Error('No payment found');
  if (contract.status !== 'VERIFIED' && contract.status !== 'DISPUTED') {
    throw new Error(`Cannot settle contract in ${contract.status} state`);
  }

  const arbitrationRun = contract.verificationRuns[0];
  if (!arbitrationRun) throw new Error('No arbitration result found');

  const arbitrationResult = JSON.parse(arbitrationRun.rawResult || '{}');
  const decision = arbitrationResult.decision || arbitrationRun.recommendation;
  const settlementPercentage = arbitrationResult.settlementPercentage ?? 100;
  const settlementAmount = Math.round((contract.budget * settlementPercentage) / 100 * 100) / 100;
  const refundAmount = Math.round((contract.budget - settlementAmount) * 100) / 100;

  let newContractStatus: string;
  let newPaymentStatus: string;

  let captureResult: any = null;
  let refundResult: any = null;

  if (decision === 'RELEASE') {
    // Full payment capture
    captureResult = await capturePayment(contract.payment.paypalOrderId || '');
    
    newContractStatus = 'SETTLED';
    newPaymentStatus = 'CAPTURED';

    await prisma.payment.update({
      where: { id: contract.payment.id },
      data: {
        status: newPaymentStatus,
        settledAmount: contract.budget,
        refundedAmount: 0,
        paypalCaptureId: captureResult.captureId,
        paypalDebugId: captureResult.debugId,
        paypalStatus: captureResult.status,
        isSimulated: captureResult.isSimulated,
        rawPaypalResponse: captureResult.rawResponse ? JSON.stringify(captureResult.rawResponse) : null,
      },
    });

    await createAuditEvent(
      'PAYMENT_CAPTURED',
      'PAYPAL',
      'SYSTEM',
      contractId,
      contract.payment.id,
      undefined,
      `$${contract.budget.toFixed(2)} captured on PayPal Sandbox [Capture ID: ${captureResult.captureId}, Order: ${contract.payment.paypalOrderId}]${captureResult.isSimulated ? ' (simulated)' : ''}`,
      {
        amount: contract.budget,
        orderId: contract.payment.paypalOrderId,
        captureId: captureResult.captureId,
        debugId: captureResult.debugId,
        isSimulated: captureResult.isSimulated,
        receiptUrl: captureResult.receiptUrl,
      }
    );
  } else if (decision === 'PARTIAL_SETTLEMENT') {
    // 1. Capture authorized budget on PayPal
    captureResult = await capturePayment(contract.payment.paypalOrderId || '');

    // 2. Issue exact mathematical partial refund to buyer via PayPal Refund API
    if (refundAmount > 0) {
      refundResult = await refundPayment(
        captureResult.captureId || '',
        refundAmount,
        contract.currency
      );

      await createAuditEvent(
        'PARTIAL_REFUND',
        'PAYPAL',
        'SYSTEM',
        contractId,
        contract.payment.id,
        undefined,
        `$${refundAmount.toFixed(2)} refunded on PayPal Sandbox [Refund ID: ${refundResult.refundId}, Capture ID: ${captureResult.captureId}]${refundResult.isSimulated ? ' (simulated)' : ''}`,
        {
          refundAmount,
          orderId: contract.payment.paypalOrderId,
          captureId: captureResult.captureId,
          refundId: refundResult.refundId,
          debugId: refundResult.debugId,
          isSimulated: refundResult.isSimulated,
          receiptUrl: refundResult.receiptUrl,
        }
      );
    }

    newContractStatus = 'PARTIALLY_SETTLED';
    newPaymentStatus = 'PARTIALLY_SETTLED';

    const mergedRawResponse = {
      orderId: contract.payment.paypalOrderId,
      capture: captureResult?.rawResponse,
      refund: refundResult?.rawResponse,
    };

    await prisma.payment.update({
      where: { id: contract.payment.id },
      data: {
        status: newPaymentStatus,
        settledAmount: settlementAmount,
        refundedAmount: refundAmount,
        paypalCaptureId: captureResult.captureId,
        paypalRefundId: refundResult?.refundId,
        paypalDebugId: refundResult?.debugId || captureResult.debugId,
        paypalStatus: 'PARTIALLY_SETTLED',
        isSimulated: captureResult.isSimulated,
        rawPaypalResponse: JSON.stringify(mergedRawResponse),
      },
    });

    await createAuditEvent(
      'PARTIAL_SETTLEMENT',
      'SYSTEM',
      'SYSTEM',
      contractId,
      contract.payment.id,
      undefined,
      `Deterministic Settlement Reconciled: $${settlementAmount.toFixed(2)} to Worker, $${refundAmount.toFixed(2)} refunded to Buyer [Order: ${contract.payment.paypalOrderId}, Capture: ${captureResult.captureId}, Refund: ${refundResult?.refundId}]`,
      {
        settlementAmount,
        refundAmount,
        settlementPercentage,
        orderId: contract.payment.paypalOrderId,
        captureId: captureResult.captureId,
        refundId: refundResult?.refundId,
        debugId: refundResult?.debugId || captureResult.debugId,
        isSimulated: captureResult.isSimulated,
      }
    );
  } else if (decision === 'REFUND') {
    refundResult = await refundPayment(contract.payment.paypalOrderId || '', contract.budget, contract.currency);

    newContractStatus = 'REFUNDED';
    newPaymentStatus = 'REFUNDED';

    await prisma.payment.update({
      where: { id: contract.payment.id },
      data: {
        status: newPaymentStatus,
        settledAmount: 0,
        refundedAmount: contract.budget,
        paypalRefundId: refundResult.refundId,
        paypalDebugId: refundResult.debugId,
        paypalStatus: 'REFUNDED',
        isSimulated: refundResult.isSimulated,
        rawPaypalResponse: refundResult.rawResponse ? JSON.stringify(refundResult.rawResponse) : null,
      },
    });

    await createAuditEvent(
      'PAYMENT_REFUNDED',
      'PAYPAL',
      'SYSTEM',
      contractId,
      contract.payment.id,
      undefined,
      `Full refund of $${contract.budget.toFixed(2)} on PayPal Sandbox [Refund ID: ${refundResult.refundId}, Order: ${contract.payment.paypalOrderId}]${refundResult.isSimulated ? ' (simulated)' : ''}`,
      {
        amount: contract.budget,
        orderId: contract.payment.paypalOrderId,
        refundId: refundResult.refundId,
        debugId: refundResult.debugId,
        isSimulated: refundResult.isSimulated,
        receiptUrl: refundResult.receiptUrl,
      }
    );
  } else {
    // HUMAN_REVIEW
    newContractStatus = 'HUMAN_REVIEW';
    newPaymentStatus = 'HUMAN_REVIEW';

    await prisma.payment.update({
      where: { id: contract.payment.id },
      data: { status: newPaymentStatus },
    });

    await createAuditEvent(
      'ESCALATED_TO_HUMAN',
      'SYSTEM',
      'SYSTEM',
      contractId,
      contract.payment.id,
      undefined,
      'Escalated to human review'
    );
  }

  await prisma.contract.update({
    where: { id: contractId },
    data: { status: newContractStatus },
  });

  // Mark as completed if settled
  if (['SETTLED', 'PARTIALLY_SETTLED', 'REFUNDED'].includes(newContractStatus)) {
    await prisma.contract.update({
      where: { id: contractId },
      data: { status: 'COMPLETED' },
    });

    await createAuditEvent(
      'CONTRACT_COMPLETED',
      'SYSTEM',
      'SYSTEM',
      contractId,
      contract.payment.id,
      undefined,
      `Contract completed with status: ${newContractStatus} [PayPal Order: ${contract.payment.paypalOrderId}]`
    );
  }

  return {
    contractStatus: newContractStatus,
    paymentStatus: newPaymentStatus,
    settlementAmount,
    refundAmount,
    decision,
    paypal: {
      orderId: contract.payment.paypalOrderId,
      captureId: captureResult?.captureId,
      refundId: refundResult?.refundId,
      debugId: refundResult?.debugId || captureResult?.debugId,
      status: newPaymentStatus,
      isSimulated: captureResult?.isSimulated ?? refundResult?.isSimulated ?? true,
      receiptUrl: refundResult?.receiptUrl || captureResult?.receiptUrl,
      rawResponse: refundResult?.rawResponse || captureResult?.rawResponse,
    },
  };
}

/**
 * File a dispute
 */
export async function fileDispute(
  contractId: string,
  agentId: string,
  reason: string,
  evidence?: string
) {
  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract) throw new Error('Contract not found');

  const dispute = await prisma.dispute.create({
    data: {
      id: uuid(),
      reason,
      evidence,
      status: 'OPEN',
      agentId,
      contractId,
    },
  });

  if (['VERIFIED', 'SETTLED', 'PARTIALLY_SETTLED'].includes(contract.status)) {
    await prisma.contract.update({
      where: { id: contractId },
      data: { status: 'DISPUTED' },
    });
  }

  await createAuditEvent(
    'DISPUTE_FILED',
    agentId,
    'AGENT',
    contractId,
    undefined,
    agentId,
    reason,
    { disputeId: dispute.id }
  );

  return dispute;
}

/**
 * Parse deadline string to milliseconds
 */
function parseDeadline(deadline: string): number {
  const match = deadline.match(/(\d+)\s*(minute|hour|day|week|month)/i);
  if (!match) return 24 * 60 * 60 * 1000; // Default 24 hours

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 'minute': return value * 60 * 1000;
    case 'hour': return value * 60 * 60 * 1000;
    case 'day': return value * 24 * 60 * 60 * 1000;
    case 'week': return value * 7 * 24 * 60 * 60 * 1000;
    case 'month': return value * 30 * 24 * 60 * 60 * 1000;
    default: return 24 * 60 * 60 * 1000;
  }
}

export { createAuditEvent, validateTransition, VALID_PAYMENT_TRANSITIONS, VALID_CONTRACT_TRANSITIONS };
