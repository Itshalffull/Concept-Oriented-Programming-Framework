import { NextRequest, NextResponse } from 'next/server';
import { canInvokeAdminConcept, getAdminSessionFromRequest } from '@/lib/auth';
import { getKernel, ensureSeeded } from '@/lib/kernel';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ concept: string; action: string }> },
) {
  const { concept, action } = await params;
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ variant: 'error', message: 'Unauthorized' }, { status: 401 });
  }
  const input = await request.json();
  if (!(await canInvokeAdminConcept(session, concept, action, input))) {
    return NextResponse.json({ variant: 'error', message: 'Forbidden' }, { status: 403 });
  }
  try {
    const kernel = getKernel();
    await ensureSeeded();
    const result = await kernel.invokeConcept(`urn:clef/${concept}`, action, input);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ variant: 'error', message: String(err) }, { status: 500 });
  }
}
