import { NextResponse } from 'next/server';
import { getRegisteredConcepts, ensureSeeded } from '@/lib/kernel';

export async function GET() {
  await ensureSeeded();
  const concepts = await getRegisteredConcepts();
  return NextResponse.json({
    status: 'ok',
    service: 'clef-base',
    concepts,
    conceptCount: concepts.length,
    auth: 'repertoire-identity',
  });
}
