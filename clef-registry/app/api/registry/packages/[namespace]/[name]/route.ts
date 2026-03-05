import { NextRequest, NextResponse } from 'next/server';
import { getKernel } from '@/lib/kernel';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ namespace: string; name: string }> },
) {
  const { namespace, name } = await params;
  const kernel = getKernel();
  const result = await kernel.invokeConcept('urn:clef/Registry', 'lookup', { name, namespace });
  return NextResponse.json(result, { status: result.variant === 'ok' ? 200 : 404 });
}
