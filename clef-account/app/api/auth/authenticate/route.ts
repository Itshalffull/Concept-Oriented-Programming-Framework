import { NextRequest, NextResponse } from 'next/server';
import { getKernel } from '@/lib/kernel';

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  const kernel = getKernel();
  const result = await kernel.invokeConcept('urn:clef/Authentication', 'authenticate', { token });
  return NextResponse.json(result, { status: result.variant === 'ok' ? 200 : 401 });
}
