import { NextRequest, NextResponse } from 'next/server';
import { getKernel } from '@/lib/kernel';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ namespace: string; name: string }> },
) {
  const { namespace, name } = await params;
  try {
    const kernel = getKernel();
    const result = await kernel.invokeConcept('urn:clef/RegistryProxy', 'versions', { namespace, name });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ variant: 'error', message: String(err) }, { status: 500 });
  }
}
