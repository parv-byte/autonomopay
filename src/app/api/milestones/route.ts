import { NextRequest, NextResponse } from 'next/server';
import { executeMilestoneStream } from '@/lib/services/milestoneService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const contractId = body.contractId || `CTR-STRM-${Date.now().toString(36).toUpperCase()}`;
    const budget = typeof body.budget === 'number' ? body.budget : 100.0;
    const items = typeof body.items === 'number' ? body.items : 500;
    const tranches = typeof body.tranches === 'number' ? body.tranches : 4;

    const streamSession = await executeMilestoneStream(contractId, budget, items, tranches);

    return NextResponse.json({
      success: true,
      session: streamSession,
    });
  } catch (error) {
    console.error('Milestone stream error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Milestone stream failed' },
      { status: 500 }
    );
  }
}

