import { NextRequest, NextResponse } from 'next/server';

/**
 * Zapier Webhook Dispatcher
 * Dispatches autonomous AI agent settlement and security ward events to Zapier
 * for instant Slack, Telegram, Discord, or Gmail alerts.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { webhookUrl, eventType = 'SETTLEMENT', data } = body;

    const payload = {
      event: eventType,
      protocol: 'AutonomoPay Technomancy Protocol v2.6',
      timestamp: new Date().toISOString(),
      contractId: data?.contractId || 'AUTOPAY-ZAP-001',
      title: data?.title || 'Scientific Research PDF Data Extraction',
      settlementAmountUSD: data?.settlementAmountUSD || 81.40,
      refundAmountUSD: data?.refundAmountUSD || 18.60,
      qualityScore: data?.qualityScore || 81.4,
      threatIntercepted: data?.threatIntercepted || false,
      paypalProvenance: {
        orderId: data?.paypalOrderId || 'ORD-ZAP-SANDBOX',
        captureId: data?.paypalCaptureId || 'CAP-ZAP-SUCCESS',
        debugId: data?.paypalDebugId || 'dbg_zap_91823',
      },
      message: eventType === 'ATTACK_BLOCKED'
        ? '🚨 SECURITY ALERT: Prompt injection financial jailbreak intercepted by AutonomoPay Ward! 100% funds protected.'
        : `⚡ SETTLEMENT RELEASED: $${data?.settlementAmountUSD || '81.40'} captured to Worker via PayPal REST v2.`,
    };

    if (webhookUrl && webhookUrl.startsWith('http')) {
      try {
        const zapRes = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        return NextResponse.json({
          success: true,
          dispatched: true,
          zapierStatus: zapRes.status,
          payload,
        });
      } catch (zapErr) {
        return NextResponse.json({
          success: true,
          dispatched: false,
          error: 'Failed to reach external webhookUrl, sample payload generated.',
          payload,
        });
      }
    }

    return NextResponse.json({
      success: true,
      dispatched: false,
      note: 'Provide webhookUrl to dispatch live to Zapier / Slack / Email.',
      sampleZapierPayload: payload,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Zapier dispatch failed' },
      { status: 500 }
    );
  }
}
