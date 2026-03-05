import { NextRequest, NextResponse } from 'next/server';
import { getKernel } from '@/lib/kernel';

export async function POST(request: NextRequest) {
  const input = await request.json();
  try {
    const kernel = getKernel();
    const result = await kernel.invokeConcept('urn:clef/Template', 'register', input);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ variant: 'error', message: String(err) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const kernel = getKernel();
    const result = await kernel.invokeConcept('urn:clef/Template', 'list', {});
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ variant: 'error', message: String(err) }, { status: 500 });
  }
}
