import { NextRequest, NextResponse } from 'next/server';
import { getKernel } from '@/lib/kernel';

export async function POST(request: NextRequest) {
  const input = await request.json();
  try {
    const kernel = getKernel();
    const loginResult = await kernel.invokeConcept('urn:clef/AccountProxy', 'login', input);
    if (loginResult.variant !== 'ok') {
      return NextResponse.json(loginResult, { status: 401 });
    }
    const sessionResult = await kernel.invokeConcept('urn:clef/Session', 'create', {
      user_id: loginResult.user_id,
      token: loginResult.token,
    });
    return NextResponse.json(sessionResult);
  } catch (err) {
    return NextResponse.json({ variant: 'error', message: String(err) }, { status: 500 });
  }
}
