import { NextRequest, NextResponse } from 'next/server';
import { getKernel } from '@/lib/kernel';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') ?? '';
  const kernel = getKernel();
  const result = await kernel.invokeConcept('urn:clef/Registry', 'search', { query });
  return NextResponse.json(result);
}
