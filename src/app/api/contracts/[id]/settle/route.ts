import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { settleContract } from '@/lib/services/contractEngine';

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
    const result = await settleContract(id);

    return NextResponse.json({ settlement: result });
  } catch (error) {
    console.error('Settle error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Settlement failed' },
      { status: 500 }
    );
  }
}
