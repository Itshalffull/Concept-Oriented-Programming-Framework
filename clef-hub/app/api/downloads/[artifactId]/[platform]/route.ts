import { NextRequest, NextResponse } from 'next/server';
import { getKernel } from '@/lib/kernel';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ artifactId: string; platform: string }> },
) {
  const { artifactId, platform } = await params;
  const versionRange = request.nextUrl.searchParams.get('version_range') ?? '*';
  try {
    const kernel = getKernel();
    const result = await kernel.invokeConcept('urn:clef/DownloadProxy', 'resolve', {
      artifact_id: artifactId, platform, version_range: versionRange,
    });
    return NextResponse.json(result, { status: result.variant === 'ok' ? 200 : 404 });
  } catch (err) {
    return NextResponse.json({ variant: 'error', message: String(err) }, { status: 500 });
  }
}
