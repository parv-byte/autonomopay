import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getPayPalMode } from '@/lib/services/paypalService';
import { getAIMode } from '@/lib/services/aiService';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get aggregated stats
    const contracts = await prisma.contract.findMany({
      where: { creatorId: user.id },
      include: { payment: true },
    });

    const totalContractValue = contracts.reduce((sum, c) => sum + c.budget, 0);
    const fundsPendingVerification = contracts
      .filter(c => ['FUNDED', 'ACCEPTED', 'IN_PROGRESS', 'DELIVERABLE_SUBMITTED', 'VERIFICATION_PENDING'].includes(c.status))
      .reduce((sum, c) => sum + c.budget, 0);
    const successfullySettled = contracts
      .filter(c => c.payment?.status === 'CAPTURED')
      .reduce((sum, c) => c.payment?.settledAmount || sum + c.budget, 0);
    const refunded = contracts
      .filter(c => ['REFUNDED', 'PARTIALLY_SETTLED'].includes(c.payment?.status || ''))
      .reduce((sum, c) => sum + (c.payment?.refundedAmount || 0), 0);
    const disputed = contracts.filter(c => c.status === 'DISPUTED').length;

    // Verification accuracy
    const verificationRuns = await prisma.verificationRun.findMany({
      where: { type: 'ARBITRATION', contract: { creatorId: user.id } },
    });
    const avgVerificationScore = verificationRuns.length > 0
      ? verificationRuns.reduce((sum, v) => sum + (v.score || 0), 0) / verificationRuns.length
      : 0;

    // Recent activity
    const recentEvents = await prisma.auditEvent.findMany({
      where: { contract: { creatorId: user.id } },
      orderBy: { timestamp: 'desc' },
      take: 20,
      include: {
        contract: { select: { id: true, title: true } },
        payment: { select: { id: true, amount: true, status: true } },
      },
    });

    // Agent stats
    const agents = await prisma.agent.findMany({
      where: { userId: user.id },
      include: {
        _count: {
          select: {
            buyerContracts: true,
            workerContracts: true,
            deliverables: true,
          },
        },
      },
    });

    // Contract status distribution
    const statusDistribution = contracts.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      overview: {
        totalContractValue,
        fundsPendingVerification,
        successfullySettled,
        refunded,
        disputed,
        aiVerificationAccuracy: Math.round(avgVerificationScore * 10) / 10,
        totalContracts: contracts.length,
        completedContracts: contracts.filter(c => c.status === 'COMPLETED').length,
      },
      statusDistribution,
      recentEvents,
      agents,
      system: {
        paypal: getPayPalMode(),
        ai: getAIMode(),
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}
