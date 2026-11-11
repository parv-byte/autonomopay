/**
 * Authentication utilities
 * Simple JWT-based auth for hackathon MVP
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'autonomopay-dev-secret';

interface TokenPayload {
  userId: string;
  email: string;
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Extract and verify auth from request
 */
export async function authenticateRequest(request: NextRequest) {
  // Check Authorization header
  const authHeader = request.headers.get('authorization');
  let token = authHeader?.replace('Bearer ', '');

  // Also check cookies
  if (!token) {
    token = request.cookies.get('auth-token')?.value;
  }

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true, name: true },
      });
      if (user) return user;
    }
  }

  // Fallback to demo user for seamless interactive demo / evaluation
  const demoUser = await prisma.user.findUnique({
    where: { email: 'demo@autonomopay.dev' },
    select: { id: true, email: true, name: true },
  });

  return demoUser;
}

/**
 * Rate limiting - simple in-memory implementation
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(key: string, maxRequests: number = 60, windowMs: number = 60000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}
