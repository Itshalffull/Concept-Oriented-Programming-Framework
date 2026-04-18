// Process execution engine — interprets a ProcessSpec's FlowBuilder steps
// and records StepRun entries. Called after ProcessRun/start via setImmediate.
//
// Wire in kernel.ts: setProcessInterpreterKernel(kernel) after boot,
// following the same pattern as setEntityReflectorKernel.

interface KernelLike {
  invokeConcept(
    uri: string,
    action: string,
    input: Record<string, unknown>,
  ): Promise<{ variant: string; [key: string]: unknown }>;
}

let _kernel: KernelLike | null = null;

export function setProcessInterpreterKernel(kernel: KernelLike): void {
  _kernel = kernel;
}

interface FbStep {
  stepId: string;
  stepKind: string;
  stepLabel: string;
  stepIndex: number;
  config: string;
}

async function executeStep(
  kernel: KernelLike,
  step: FbStep,
  scope: Record<string, unknown>,
): Promise<{ output: Record<string, unknown>; failed?: string }> {
  const config = (() => {
    try { return JSON.parse(step.config || '{}') as Record<string, unknown>; }
    catch { return {}; }
  })();

  if (step.stepKind === 'action') {
    const conceptAction = config.conceptAction as string | undefined;
    if (conceptAction) {
      const slash = conceptAction.indexOf('/');
      if (slash > 0) {
        const conceptName = conceptAction.slice(0, slash);
        const actionName = conceptAction.slice(slash + 1);
        const rawInput = config.input ?? {};
        const actionInput: Record<string, unknown> = typeof rawInput === 'string'
          ? (JSON.parse(rawInput) as Record<string, unknown>)
          : (rawInput as Record<string, unknown>);
        const result = await kernel.invokeConcept(`urn:clef/${conceptName}`, actionName, { ...scope, ...actionInput });
        if (result.variant !== 'ok') {
          return { output: {}, failed: `${conceptAction} returned ${result.variant}` };
        }
        return { output: result as Record<string, unknown> };
      }
    }
  }

  // All other kinds (trigger, branch, logic, catch) and unconfigured action
  // steps complete immediately.
  return { output: {} };
}

export async function interpretRun(runId: string, specRef: string): Promise<void> {
  const kernel = _kernel;
  if (!kernel) return;

  try {
    const stepsResult = await kernel.invokeConcept('urn:clef/ProcessSpec', 'getSteps', { spec: specRef });
    if (stepsResult.variant !== 'ok') return;

    const rawSteps = stepsResult.steps;
    const steps: FbStep[] = Array.isArray(rawSteps)
      ? (rawSteps as FbStep[])
      : [];

    // No steps defined — leave the run in "running" state for manual completion.
    if (steps.length === 0) return;

    const ordered = [...steps].sort((a, b) => a.stepIndex - b.stepIndex);
    const scope: Record<string, unknown> = {};

    for (const step of ordered) {
      const startResult = await kernel.invokeConcept('urn:clef/StepRun', 'start', {
        run_ref: runId,
        step_key: step.stepId,
        step_type: step.stepKind,
        input: JSON.stringify(scope),
      });

      if (startResult.variant !== 'ok') continue;
      const stepRunId = startResult.step as string;

      const { output, failed } = await executeStep(kernel, step, scope).catch((err) => ({
        output: {},
        failed: err instanceof Error ? err.message : String(err),
      }));

      if (failed) {
        await kernel.invokeConcept('urn:clef/StepRun', 'fail', {
          step: stepRunId,
          error: failed,
        }).catch(() => {});
        await kernel.invokeConcept('urn:clef/ProcessRun', 'fail', {
          run: runId,
          error: `Step "${step.stepLabel}" failed: ${failed}`,
        }).catch(() => {});
        return;
      }

      // Thread step output into the running scope for downstream steps
      Object.assign(scope, output);

      await kernel.invokeConcept('urn:clef/StepRun', 'complete', {
        step: stepRunId,
        output: JSON.stringify(output),
      }).catch(() => {});
    }

    // All steps completed — auto-complete the run.
    await kernel.invokeConcept('urn:clef/ProcessRun', 'complete', {
      run: runId,
      output: JSON.stringify(scope),
    }).catch(() => {});

  } catch (err) {
    await _kernel?.invokeConcept('urn:clef/ProcessRun', 'fail', {
      run: runId,
      error: err instanceof Error ? err.message : String(err),
    }).catch(() => {});
  }
}
