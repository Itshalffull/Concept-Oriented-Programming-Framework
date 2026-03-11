import { NextRequest, NextResponse } from 'next/server';
import { getAccessSnapshot, getAdminSessionFromRequest } from '@/lib/auth';
import { ADMIN_PERMISSION } from '@/lib/identity';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session || !session.permissions.includes(ADMIN_PERMISSION)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(await getAccessSnapshot());
}
