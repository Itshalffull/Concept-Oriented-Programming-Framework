import { NextRequest, NextResponse } from 'next/server';
import { createAccessUser, getAdminSessionFromRequest } from '@/lib/auth';
import { ADMIN_PERMISSION } from '@/lib/identity';

export async function POST(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session || !session.permissions.includes(ADMIN_PERMISSION)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const input = (await request.json()) as {
    user?: string;
    password?: string;
    provider?: string;
    roles?: string[];
  };

  await createAccessUser({
    user: String(input.user ?? ''),
    password: String(input.password ?? ''),
    provider: String(input.provider ?? 'local'),
    roles: Array.isArray(input.roles) ? input.roles.map((role) => String(role)) : [],
  });

  return NextResponse.json({ ok: true });
}
