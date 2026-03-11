import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest, updateNodeAccess } from '@/lib/auth';
import { ADMIN_PERMISSION } from '@/lib/identity';

export async function POST(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session || !session.permissions.includes(ADMIN_PERMISSION)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const input = (await request.json()) as {
    node?: string;
    action?: string;
    roles?: string[];
  };

  await updateNodeAccess({
    node: String(input.node ?? ''),
    action: String(input.action ?? ''),
    roles: Array.isArray(input.roles) ? input.roles.map((role) => String(role)) : [],
  });

  return NextResponse.json({ ok: true });
}
