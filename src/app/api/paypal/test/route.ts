import { NextResponse } from 'next/server';
import { testPayPalConnection, getPayPalMode } from '@/lib/services/paypalService';

export async function GET() {
  try {
    const mode = getPayPalMode();
    const testResult = await testPayPalConnection();

    return NextResponse.json({
      mode,
      connection: testResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'PayPal connection test failed' },
      { status: 500 }
    );
  }
}

