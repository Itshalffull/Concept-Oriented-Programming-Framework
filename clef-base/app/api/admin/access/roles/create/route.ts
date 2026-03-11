import { NextRequest, NextResponse } from 'next/server';
import { createAccessRole, getAdminSessionFromRequest } from '@/lib/auth';
import { ADMIN_PERMISSION } from '@/lib/identity';

export async function POST(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session || !session.permissions.includes(ADMIN_PERMISSION)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const input = (await request.json()) as { role?: string };
  await createAccessRole(String(input.role ?? ''));
  return NextResponse.json({ ok: true });
}
