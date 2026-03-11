import { NextRequest, NextResponse } from 'next/server';
import { getKernel } from '@/lib/kernel';

export async function POST(request: NextRequest) {
  const input = await request.json();
  const kernel = getKernel();
  const result = await kernel.invokeConcept('urn:clef/Registry', 'register', input);
  return NextResponse.json(result, { status: result.variant === 'ok' ? 201 : 409 });
}
