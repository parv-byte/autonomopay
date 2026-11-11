import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { fileDispute } from '@/lib/services/contractEngine';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { agentId, reason, evidence } = body;

    if (!agentId || !reason) {
      return NextResponse.json({ error: 'Agent ID and reason are required' }, { status: 400 });
    }

    const dispute = await fileDispute(id, agentId, reason, evidence);

    return NextResponse.json({ dispute });
  } catch (error) {
    console.error('Dispute error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Dispute filing failed' },
      { status: 500 }
    );
  }
}
