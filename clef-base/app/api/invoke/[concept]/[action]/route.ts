import { NextRequest, NextResponse } from 'next/server';
import { canInvokeAdminConcept, getAdminSessionFromRequest } from '@/lib/auth';
import { getKernel, ensureSeeded } from '@/lib/kernel';

// Pilot verb vocabulary that must be gated by PilotMode. Query-only
// verbs (where, destinations, snapshot, read, views, viewInfo, overlays,
// snapshotBindings) are intentionally excluded — they are observational.
// Navigation verbs (back, forward, navigate) are gated so navigate-only
// mode can still block submit/fill/interact/effect without blocking
// navigation itself.
const PILOT_GATED_VERBS: Record<string, string> = {
  navigate: 'navigate',
  back: 'navigate',
  forward: 'navigate',
  interact: 'interact',
  fill: 'fill',
  submit: 'submit',
  effect: 'effect',
  dismiss: 'dismiss',
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ concept: string; action: string }> },
) {
  const { concept, action } = await params;
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ variant: 'error', message: 'Unauthorized' }, { status: 401 });
  }
  const input = await request.json();
  if (!(await canInvokeAdminConcept(session, concept, action, input))) {
    return NextResponse.json({ variant: 'error', message: 'Forbidden' }, { status: 403 });
  }
  try {
    const kernel = getKernel();
    await ensureSeeded();

    // PilotMode gate — §9.3 of agents-as-subjects-refactor-plan.
    // Every mutating Pilot verb is checked against PilotMode/check BEFORE
    // dispatching. An ok(allowed:false) short-circuits with
    // ok(blocked:true) — the session saw a bounded environment, not an
    // error.
    if (concept === 'Pilot' && PILOT_GATED_VERBS[action]) {
      const mode = readPilotMode(request, input);
      if (mode) {
        const verb = PILOT_GATED_VERBS[action];
        const gate = await kernel.invokeConcept('urn:clef/PilotMode', 'check', {
          mode,
          verb,
        });
        if (gate && (gate as Record<string, unknown>).variant === 'ok'
            && (gate as Record<string, unknown>).allowed === false) {
          return NextResponse.json({
            variant: 'ok',
            blocked: true,
            reason: `Pilot verb "${verb}" is restricted by PilotMode "${mode}"`,
            mode,
            verb,
          });
        }
      }
    }

    const result = await kernel.invokeConcept(`urn:clef/${concept}`, action, input);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ variant: 'error', message: String(err) }, { status: 500 });
  }
}

function readPilotMode(request: NextRequest, input: unknown): string | null {
  // Resolution order: explicit input.mode > x-pilot-mode header > cookie.
  if (input && typeof input === 'object' && 'mode' in (input as Record<string, unknown>)) {
    const m = (input as Record<string, unknown>).mode;
    if (typeof m === 'string' && m.trim() !== '') return m;
  }
  const header = request.headers.get('x-pilot-mode');
  if (header && header.trim() !== '') return header;
  const cookie = request.cookies.get('pilot-mode');
  if (cookie?.value && cookie.value.trim() !== '') return cookie.value;
  return null;
}
