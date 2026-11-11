import { NextRequest, NextResponse } from 'next/server';
import {
  scanDeliverableForThreats,
  generateAdversarialDeliverable,
  executeNeutralizationShield,
} from '@/lib/services/securityShield';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const contractId = body.contractId || `CTR-SEC-TEST-${Date.now().toString(36).toUpperCase()}`;
    const budget = typeof body.budget === 'number' ? body.budget : 100.0;

    // Step 1: Generate rogue payload with prompt injection
    const roguePayload = generateAdversarialDeliverable();

    // Step 2: Scan with security shield
    const scanResult = scanDeliverableForThreats(roguePayload);

    // Step 3: Neutralize threat and issue full refund
    const incident = await executeNeutralizationShield(contractId, budget);

    return NextResponse.json({
      success: true,
      scanResult,
      incident,
      simulatedPayload: JSON.parse(roguePayload),
    });
  } catch (error) {
    console.error('Security attack simulation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Security simulation failed' },
      { status: 500 }
    );
  }
}

