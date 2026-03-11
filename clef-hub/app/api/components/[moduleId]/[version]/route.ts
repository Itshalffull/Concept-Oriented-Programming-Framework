import { NextRequest, NextResponse } from 'next/server';
import { getKernel } from '@/lib/kernel';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ moduleId: string; version: string }> },
) {
  const { moduleId, version } = await params;
  try {
    const kernel = getKernel();
    const result = await kernel.invokeConcept('urn:clef/ComponentManifestProxy', 'lookup', {
      module_id: moduleId, version,
    });
    return NextResponse.json(result, { status: result.variant === 'ok' ? 200 : 404 });
  } catch (err) {
    return NextResponse.json({ variant: 'error', message: String(err) }, { status: 500 });
  }
}
