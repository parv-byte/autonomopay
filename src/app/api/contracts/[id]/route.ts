import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET - Get a specific contract with all details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, email: true, name: true } },
        buyerAgent: true,
        workerAgent: true,
        payment: true,
        acceptanceCriteria: true,
        milestones: { orderBy: { order: 'asc' } },
        deliverables: {
          orderBy: { createdAt: 'desc' },
          include: { agent: { select: { id: true, name: true, avatar: true } } },
        },
        verificationRuns: {
          orderBy: { createdAt: 'asc' },
          include: { results: true },
        },
        disputes: {
          include: { agent: { select: { id: true, name: true, avatar: true } } },
        },
        auditEvents: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    if (contract.creatorId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({ contract });
  } catch (error) {
    console.error('Get contract error:', error);
    return NextResponse.json({ error: 'Failed to get contract' }, { status: 500 });
  }
}
