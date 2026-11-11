import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { acceptContract } from '@/lib/services/contractEngine';

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
    const { workerAgentId } = body;

    if (!workerAgentId) {
      return NextResponse.json({ error: 'Worker agent ID required' }, { status: 400 });
    }

    const result = await acceptContract(id, workerAgentId);
    return NextResponse.json({ contract: result });
  } catch (error) {
    console.error('Accept error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to accept contract' },
      { status: 500 }
    );
  }
}
