import { NextRequest, NextResponse } from 'next/server';
import { logoutCurrentSession } from '@/lib/auth';
import { AUTH_COOKIE_NAME } from '@/lib/identity';

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  await logoutCurrentSession(sessionId);

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}
