import { NextRequest, NextResponse } from 'next/server';
import { loginAsAdmin } from '@/lib/auth';
import { AUTH_COOKIE_NAME } from '@/lib/identity';

export async function POST(request: NextRequest) {
  const input = (await request.json()) as { user?: string; password?: string };
  const result = await loginAsAdmin({
    user: String(input.user ?? ''),
    password: String(input.password ?? ''),
    device: request.headers.get('user-agent') ?? 'browser',
  });

  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: 401 });
  }

  const response = NextResponse.json({
    ok: true,
    permissions: result.permissions,
    admin: result.permissions.includes('admin.access'),
  });
  response.cookies.set(AUTH_COOKIE_NAME, result.sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
  return response;
}
