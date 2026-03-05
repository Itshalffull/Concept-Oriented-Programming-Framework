import { NextRequest, NextResponse } from 'next/server';
import { getKernel } from '@/lib/kernel';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const input = await request.json();
  try {
    const kernel = getKernel();
    const result = await kernel.invokeConcept('urn:clef/Template', 'render', { name, ...input });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ variant: 'error', message: String(err) }, { status: 500 });
  }
}
