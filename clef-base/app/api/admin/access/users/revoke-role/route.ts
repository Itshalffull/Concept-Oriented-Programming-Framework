import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest, revokeAccessRole } from '@/lib/auth';
import { ADMIN_PERMISSION } from '@/lib/identity';

export async function POST(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session || !session.permissions.includes(ADMIN_PERMISSION)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const input = (await request.json()) as { user?: string; role?: string };
  await revokeAccessRole(String(input.user ?? ''), String(input.role ?? ''));
  return NextResponse.json({ ok: true });
}
