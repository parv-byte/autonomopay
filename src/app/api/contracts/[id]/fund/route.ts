import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { fundContract } from '@/lib/services/contractEngine';

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
    const result = await fundContract(id, user.id);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Fund contract error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fund contract' },
      { status: 500 }
    );
  }
}
