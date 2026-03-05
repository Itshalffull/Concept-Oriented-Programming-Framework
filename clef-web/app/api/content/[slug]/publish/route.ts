import { NextRequest, NextResponse } from 'next/server';
import { getKernel } from '@/lib/kernel';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const input = await request.json();
  try {
    const kernel = getKernel();
    const result = await kernel.invokeConcept('urn:clef/ContentNode', 'publish', { slug, ...input });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ variant: 'error', message: String(err) }, { status: 500 });
  }
}
