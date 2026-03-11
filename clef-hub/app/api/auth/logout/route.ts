import { NextRequest, NextResponse } from 'next/server';
import { getKernel } from '@/lib/kernel';

export async function POST(request: NextRequest) {
  const input = await request.json();
  try {
    const kernel = getKernel();
    const validateResult = await kernel.invokeConcept('urn:clef/Session', 'validate', {
      session_id: input.session_id,
    });
    if (validateResult.variant !== 'ok') {
      return NextResponse.json(validateResult, { status: 401 });
    }
    await kernel.invokeConcept('urn:clef/Session', 'destroy', {
      session_id: input.session_id,
    });
    const logoutResult = await kernel.invokeConcept('urn:clef/AccountProxy', 'logout', {
      token: validateResult.token,
    });
    return NextResponse.json(logoutResult);
  } catch (err) {
    return NextResponse.json({ variant: 'error', message: String(err) }, { status: 500 });
  }
}
