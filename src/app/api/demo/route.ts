import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createContractFromNL, fundContract, acceptContract, submitDeliverable, verifyDeliverable, settleContract } from '@/lib/services/contractEngine';
import { generateSuccessDeliverable, generateFailedDeliverable, DEMO_CONTRACT_INPUT, seedDemoData } from '@/lib/services/demoData';
import { generateToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    let user = await authenticateRequest(request);
    
    // Auto-create demo user if not authenticated
    if (!user) {
      const demoUser = await seedDemoData(prisma);
      user = { id: demoUser.id, email: demoUser.email, name: demoUser.name };
    }

    const body = await request.json().catch(() => ({}));
    const simulateFailure = body.simulateFailure === true;

    const events: Array<{
      timestamp: string;
      actor: string;
      event: string;
      detail: string;
      status: 'success' | 'error' | 'pending' | 'info';
    }> = [];

    const addEvent = (actor: string, event: string, detail: string, status: 'success' | 'error' | 'pending' | 'info' = 'success') => {
      events.push({
        timestamp: new Date().toISOString(),
        actor,
        event,
        detail,
        status,
      });
    };

    // Step 1: Create contract
    addEvent('BUYER_AGENT', 'CONTRACT_CREATED', 'Creating contract from natural language...');
    const contract = await createContractFromNL(
      user.id,
      'agent-buyer-demo',
      DEMO_CONTRACT_INPUT
    );
    addEvent('BUYER_AGENT', 'CONTRACT_CREATED', `Contract "${contract.title}" created with $${contract.budget} budget`, 'success');

    // Step 2: Fund contract
    addEvent('BUYER_AGENT', 'PAYMENT_AUTHORIZING', 'Authorizing payment through PayPal...', 'pending');
    const funded = await fundContract(contract.id, user.id);
    addEvent('BUYER_AGENT', 'PAYMENT_AUTHORIZED', `$${contract.budget} authorized (PayPal Order: ${funded.payment.paypalOrderId})`, 'success');

    // Step 3: Worker accepts
    addEvent('WORKER_AGENT', 'TASK_ACCEPTED', 'DataExtract Pro has accepted the task', 'success');
    await acceptContract(contract.id, 'agent-worker-demo');

    // Step 4: Worker submits deliverable
    addEvent('WORKER_AGENT', 'PROCESSING', 'Processing 500 research PDFs...', 'pending');
    const deliverableContent = simulateFailure
      ? generateFailedDeliverable()
      : generateSuccessDeliverable();
    
    const deliverable = await submitDeliverable(contract.id, 'agent-worker-demo', deliverableContent);
    
    if (simulateFailure) {
      addEvent('WORKER_AGENT', 'DELIVERABLE_SUBMITTED', 'Deliverable submitted (467/500 documents processed, 81.4% accuracy)', 'info');
    } else {
      addEvent('WORKER_AGENT', 'DELIVERABLE_SUBMITTED', 'Deliverable submitted (500/500 documents, 97.2% accuracy)', 'success');
    }

    // Step 5: Run verification
    addEvent('VERIFIER_AGENT', 'VERIFICATION_STARTED', 'Starting verification pipeline...', 'pending');
    const verification = await verifyDeliverable(contract.id);

    addEvent('VERIFIER_AGENT', 'STRUCTURAL_CHECK', `Structural validation: ${verification.structural.score}/100`, verification.structural.passed ? 'success' : 'error');
    addEvent('VERIFIER_AGENT', 'QUALITY_CHECK', `AI quality evaluation: ${verification.quality.score}/100`, verification.quality.score >= 90 ? 'success' : 'error');
    addEvent('VERIFIER_AGENT', 'DETERMINISTIC_CHECK', `Deterministic tests: ${verification.deterministic.score}/100`, verification.deterministic.passed ? 'success' : 'error');
    addEvent('ARBITRATOR_AGENT', 'ARBITRATION_DECISION', `Decision: ${verification.arbitration.decision} (Score: ${verification.arbitration.finalScore}/100)`, verification.arbitration.decision === 'RELEASE' ? 'success' : 'info');

    // Step 6: Settle via PayPal
    addEvent('PAYPAL', 'SETTLEMENT_PROCESSING', 'Executing PayPal Sandbox conditional settlement...', 'pending');
    const settlement = await settleContract(contract.id);

    if (settlement.decision === 'RELEASE') {
      addEvent(
        'PAYPAL',
        'PAYMENT_CAPTURED',
        `PayPal Capture [${settlement.paypal?.captureId}] confirmed ($${settlement.settlementAmount.toFixed(2)} released, Order: ${settlement.paypal?.orderId})`,
        'success'
      );
      addEvent(
        'PAYPAL',
        'TRANSACTION_SETTLED',
        `Worker paid $${settlement.settlementAmount.toFixed(2)} via PayPal Sandbox [Debug ID: ${settlement.paypal?.debugId}]`,
        'success'
      );
    } else if (settlement.decision === 'PARTIAL_SETTLEMENT') {
      addEvent(
        'PAYPAL',
        'PAYMENT_CAPTURED',
        `PayPal Initial Capture [${settlement.paypal?.captureId}] confirmed ($${contract.budget.toFixed(2)} from Order: ${settlement.paypal?.orderId})`,
        'success'
      );
      addEvent(
        'PAYPAL',
        'PARTIAL_REFUND',
        `PayPal Refund [${settlement.paypal?.refundId}] dispatched: $${settlement.refundAmount.toFixed(2)} returned to Buyer Agent`,
        'info'
      );
      addEvent(
        'PAYPAL',
        'SETTLEMENT_RECONCILED',
        `Deterministic Settlement Reconciled: Worker $${settlement.settlementAmount.toFixed(2)} (81.4%) + Buyer Refund $${settlement.refundAmount.toFixed(2)} (18.6%) [Debug ID: ${settlement.paypal?.debugId}]`,
        'success'
      );
    } else if (settlement.decision === 'REFUND') {
      addEvent(
        'PAYPAL',
        'PAYMENT_REFUNDED',
        `PayPal Refund [${settlement.paypal?.refundId}] dispatched: Full refund of $${contract.budget.toFixed(2)} to Buyer Agent`,
        'error'
      );
    }

    // Generate auth token for the response
    const token = generateToken({ userId: user.id, email: user.email });

    return NextResponse.json({
      success: true,
      contractId: contract.id,
      events,
      summary: {
        task: contract.task,
        budget: contract.budget,
        decision: settlement.decision,
        settlementAmount: settlement.settlementAmount,
        refundAmount: settlement.refundAmount,
        verificationScore: verification.arbitration.finalScore,
        explanation: verification.overall.explanation,
        formula: verification.overall.formula,
        mathSteps: verification.overall.mathSteps,
        reconciliation: verification.overall.reconciliation,
      },
      paypal: settlement.paypal,
      verification: {
        structural: { score: verification.structural.score, passed: verification.structural.passed },
        quality: { score: verification.quality.score, recommendation: verification.quality.recommendation },
        deterministic: { score: verification.deterministic.score, passed: verification.deterministic.passed },
        arbitration: verification.arbitration,
        mathCalculation: verification.mathCalculation,
      },
      token,
    });
  } catch (error) {
    console.error('Demo error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Demo failed', details: String(error) },
      { status: 500 }
    );
  }
}
