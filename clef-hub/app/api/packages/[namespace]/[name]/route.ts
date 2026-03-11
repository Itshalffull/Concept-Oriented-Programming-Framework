import { NextRequest, NextResponse } from 'next/server';
import { getKernel } from '@/lib/kernel';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ namespace: string; name: string }> },
) {
  const { namespace, name } = await params;
  try {
    const kernel = getKernel();
    const result = await kernel.invokeConcept('urn:clef/RegistryProxy', 'lookup', { namespace, name });
    return NextResponse.json(result, { status: result.variant === 'ok' ? 200 : 404 });
  } catch (err) {
    return NextResponse.json({ variant: 'error', message: String(err) }, { status: 500 });
  }
}
