import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { submitDeliverable } from '@/lib/services/contractEngine';
import { generateSuccessDeliverable, generateFailedDeliverable } from '@/lib/services/demoData';

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
    const { content, agentId, simulateFailure } = body;

    // Validate
    if (!agentId) {
      return NextResponse.json({ error: 'Agent ID required' }, { status: 400 });
    }

    // Generate demo deliverable if no content provided
    let deliverableContent = content;
    if (!deliverableContent) {
      deliverableContent = simulateFailure
        ? generateFailedDeliverable()
        : generateSuccessDeliverable();
    }

    // Validate content size (max 10MB)
    if (deliverableContent.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Deliverable too large (max 10MB)' }, { status: 400 });
    }

    const deliverable = await submitDeliverable(id, agentId, deliverableContent);

    return NextResponse.json({ deliverable });
  } catch (error) {
    console.error('Deliver error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit deliverable' },
      { status: 500 }
    );
  }
}
