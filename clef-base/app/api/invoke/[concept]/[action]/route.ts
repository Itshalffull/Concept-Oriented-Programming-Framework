import { NextRequest, NextResponse } from 'next/server';
import { getKernel, ensureSeeded } from '@/lib/kernel';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ concept: string; action: string }> },
) {
  const { concept, action } = await params;
  const input = await request.json();
  try {
    const kernel = getKernel();
    await ensureSeeded();
    const result = await kernel.invokeConcept(`urn:clef/${concept}`, action, input);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ variant: 'error', message: String(err) }, { status: 500 });
  }
}
