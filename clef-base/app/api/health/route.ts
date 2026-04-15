import { NextRequest, NextResponse } from 'next/server';
import { getRegisteredConcepts, getRegisteredSyncs, ensureSeeded, getKernel } from '@/lib/kernel';

// Note: POST handler below is a temporary test endpoint for sync chain debugging.

export async function GET() {
  await ensureSeeded();
  const [concepts, syncs] = await Promise.all([
    getRegisteredConcepts(),
    getRegisteredSyncs(),
  ]);
  return NextResponse.json({
    status: 'ok',
    service: 'clef-base',
    concepts,
    conceptCount: concepts.length,
    syncs: syncs.length,
    syncCount: syncs.length,
    auth: 'repertoire-identity',
  });
}

// Temporary test endpoint for sync chain debugging
export async function POST(request: NextRequest) {
  await ensureSeeded();
  const kernel = getKernel();
  const { concept, action, input, _flowLog } = await request.json();
  try {
    if (_flowLog) {
      // Return the flow log for a given flowId
      const records = kernel.getFlowLog(_flowLog);
      return NextResponse.json({ records });
    }
    if (concept === '_debug_syncs') {
      const eng = (kernel as any)._syncEngine;
      const index = eng?.index as Map<string, Set<any>> | undefined;
      const keys = index ? [...index.keys()] : [];
      const syncNames: Record<string, string[]> = {};
      if (index) {
        for (const [k, v] of index) {
          syncNames[k] = [...v].map((s: any) => s.name);
        }
      }
      return NextResponse.json({ indexKeys: keys, syncNames, count: keys.length });
    }
    const result = await kernel.invokeConcept(concept, action, input ?? {});
    // Also return the flow log inline for debugging
    const flowRecords = kernel.getFlowLog(result.flowId as string);
    return NextResponse.json({ ...result, _flowLog: flowRecords });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
