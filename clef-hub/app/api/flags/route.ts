import { NextRequest, NextResponse } from 'next/server';
import { getKernel } from '@/lib/kernel';

export async function POST(request: NextRequest) {
  const input = await request.json();
  try {
    const kernel = getKernel();
    const result = await kernel.invokeConcept('urn:clef/Flag', 'create', input);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ variant: 'error', message: String(err) }, { status: 500 });
  }
}
