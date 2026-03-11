import { NextRequest, NextResponse } from 'next/server';
import { getKernel } from '@/lib/kernel';

export async function GET() {
  try {
    const kernel = getKernel();
    const result = await kernel.invokeConcept('urn:clef/Outline', 'get', {});
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ variant: 'error', message: String(err) }, { status: 500 });
  }
}
