import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, checkRateLimit } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createContractFromNL } from '@/lib/services/contractEngine';
import { parseContract } from '@/lib/services/aiService';

// GET - List contracts
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contracts = await prisma.contract.findMany({
      where: { creatorId: user.id },
      include: {
        buyerAgent: { select: { id: true, name: true, avatar: true, type: true } },
        workerAgent: { select: { id: true, name: true, avatar: true, type: true } },
        payment: { select: { id: true, status: true, amount: true, settledAmount: true, refundedAmount: true } },
        acceptanceCriteria: true,
        _count: {
          select: {
            deliverables: true,
            verificationRuns: true,
            disputes: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ contracts });
  } catch (error) {
    console.error('List contracts error:', error);
    return NextResponse.json({ error: 'Failed to list contracts' }, { status: 500 });
  }
}

// POST - Create a new contract
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!checkRateLimit(user.id, 10, 60000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const body = await request.json();
    const { input, buyerAgentId } = body;

    if (!input) {
      return NextResponse.json({ error: 'Contract input is required' }, { status: 400 });
    }

    // Validate input length
    if (input.length > 5000) {
      return NextResponse.json({ error: 'Input too long (max 5000 chars)' }, { status: 400 });
    }

    // If just parsing, return parsed result for review
    if (body.parseOnly) {
      const parsed = await parseContract(input);
      return NextResponse.json({ parsed });
    }

    // Get or create buyer agent
    let agentId = buyerAgentId;
    if (!agentId) {
      const agent = await prisma.agent.findFirst({
        where: { userId: user.id, type: 'BUYER' },
      });
      if (agent) {
        agentId = agent.id;
      } else {
        return NextResponse.json({ error: 'No buyer agent found. Create one first.' }, { status: 400 });
      }
    }

    const contract = await createContractFromNL(user.id, agentId, input);

    // Reload with relations
    const fullContract = await prisma.contract.findUnique({
      where: { id: contract.id },
      include: {
        buyerAgent: true,
        acceptanceCriteria: true,
        milestones: true,
      },
    });

    return NextResponse.json({ contract: fullContract }, { status: 201 });
  } catch (error) {
    console.error('Create contract error:', error);
    return NextResponse.json({ error: 'Failed to create contract' }, { status: 500 });
  }
}
