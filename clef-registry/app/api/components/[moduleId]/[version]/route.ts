import { NextRequest, NextResponse } from 'next/server';
import { getKernel } from '@/lib/kernel';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ moduleId: string; version: string }> },
) {
  const { moduleId, version } = await params;
  const kernel = getKernel();
  const result = await kernel.invokeConcept('urn:clef/ComponentManifest', 'lookup', {
    module_id: moduleId, version,
  });
  return NextResponse.json(result, { status: result.variant === 'ok' ? 200 : 404 });
}
