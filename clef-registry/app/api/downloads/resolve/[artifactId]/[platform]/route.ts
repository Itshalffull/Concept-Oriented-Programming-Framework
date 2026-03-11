import { NextRequest, NextResponse } from 'next/server';
import { getKernel } from '@/lib/kernel';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ artifactId: string; platform: string }> },
) {
  const { artifactId, platform } = await params;
  const versionRange = request.nextUrl.searchParams.get('version_range') ?? '*';
  const kernel = getKernel();
  const result = await kernel.invokeConcept('urn:clef/Download', 'resolve', {
    artifact_id: artifactId, platform, version_range: versionRange,
  });
  return NextResponse.json(result, { status: result.variant === 'ok' ? 200 : 404 });
}
