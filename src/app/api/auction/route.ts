import { NextRequest, NextResponse } from 'next/server';
import { runReverseAuction } from '@/lib/services/auctionService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const taskTitle = body.taskTitle || '500 Scientific Research PDF Extraction & Schema Structuring';
    const budgetCeiling = typeof body.budget === 'number' ? body.budget : 100.0;

    const auctionResult = runReverseAuction(taskTitle, budgetCeiling);

    return NextResponse.json({
      success: true,
      auction: auctionResult,
    });
  } catch (error) {
    console.error('Auction error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Auction failed' },
      { status: 500 }
    );
  }
}

