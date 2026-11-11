import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const clientId = process.env.PAYPAL_CLIENT_ID || '';
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || '';
  const isConfigured = !!(
    clientId &&
    clientSecret &&
    clientId !== 'your_paypal_sandbox_client_id' &&
    clientSecret !== 'your_paypal_sandbox_client_secret'
  );

  return NextResponse.json({
    isConfigured,
    clientIdMasked: clientId.length > 8 ? `${clientId.slice(0, 4)}...${clientId.slice(-4)}` : (isConfigured ? 'configured' : 'not_set'),
    environment: process.env.PAYPAL_ENVIRONMENT || 'sandbox',
  });
}

export async function POST(request: NextRequest) {
  try {
    const { clientId, clientSecret } = await request.json();

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Client ID and Client Secret are required' }, { status: 400 });
    }

    // Test credentials against PayPal Sandbox OAuth endpoint
    const baseUrl = process.env.PAYPAL_API_URL || 'https://api-m.sandbox.paypal.com';
    const authHeader = Buffer.from(`${clientId.trim()}:${clientSecret.trim()}`).toString('base64');

    const testResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${authHeader}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      return NextResponse.json(
        {
          success: false,
          error: `PayPal Sandbox rejected credentials (${testResponse.status}): ${errorText}`,
        },
        { status: 400 }
      );
    }

    const tokenData = await testResponse.json();

    // Update in-memory process.env
    process.env.PAYPAL_CLIENT_ID = clientId.trim();
    process.env.PAYPAL_CLIENT_SECRET = clientSecret.trim();

    // Persist to .env file
    try {
      const envPath = path.join(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        envContent = envContent.replace(
          /PAYPAL_CLIENT_ID=.*/,
          `PAYPAL_CLIENT_ID="${clientId.trim()}"`
        );
        envContent = envContent.replace(
          /PAYPAL_CLIENT_SECRET=.*/,
          `PAYPAL_CLIENT_SECRET="${clientSecret.trim()}"`
        );
        fs.writeFileSync(envPath, envContent, 'utf8');
      }
    } catch (fsErr) {
      console.warn('Could not update .env file on disk, updated in-memory:', fsErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully connected and verified PayPal Sandbox credentials!',
      appId: tokenData.app_id,
      expiresIn: tokenData.expires_in,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Configuration failed' },
      { status: 500 }
    );
  }
}

