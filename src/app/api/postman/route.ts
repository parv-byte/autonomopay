import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'AutonomoPay-PayPal-AI.postman_collection.json');
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return new NextResponse(data, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="AutonomoPay-PayPal-AI.postman_collection.json"',
        },
      });
    }
    return NextResponse.json({ error: 'Postman collection not found' }, { status: 404 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to download Postman collection' }, { status: 500 });
  }
}
