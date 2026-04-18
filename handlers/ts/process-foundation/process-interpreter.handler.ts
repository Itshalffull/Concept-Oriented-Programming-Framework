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
): Promise<{ output: Record<string, unknown>; failed?: string; manual?: boolean }> {
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

  // Manual steps pause the run for human action — caller handles suspension.
  if (step.stepKind === 'manual') {
    return { output: {}, manual: true };
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

    // Load already-completed step runs so we can resume mid-flow.
    const existingResult = await kernel.invokeConcept('urn:clef/StepRun', 'list', { run_ref: runId });
    const existingStepRuns: Array<Record<string, unknown>> =
      existingResult.variant === 'ok' && Array.isArray(existingResult.step_runs)
        ? (existingResult.step_runs as Array<Record<string, unknown>>)
        : [];
    const completedStepKeys = new Set(
      existingStepRuns
        .filter(s => s.status === 'completed')
        .map(s => s.step_key as string),
    );

    const ordered = [...steps].sort((a, b) => a.stepIndex - b.stepIndex);
    const scope: Record<string, unknown> = {};

    for (const step of ordered) {
      // Skip steps already completed in a previous interpreter pass.
      if (completedStepKeys.has(step.stepId)) continue;

      const startResult = await kernel.invokeConcept('urn:clef/StepRun', 'start', {
        run_ref: runId,
        step_key: step.stepId,
        step_type: step.stepKind,
        input: JSON.stringify(scope),
      });

      if (startResult.variant !== 'ok') continue;
      const stepRunId = startResult.step as string;

      const result = await executeStep(kernel, step, scope).catch((err) => ({
        output: {},
        failed: err instanceof Error ? err.message : String(err),
        manual: undefined as boolean | undefined,
      }));

      if (result.failed) {
        await kernel.invokeConcept('urn:clef/StepRun', 'fail', {
          step: stepRunId,
          error: result.failed,
        }).catch(() => {});
        await kernel.invokeConcept('urn:clef/ProcessRun', 'fail', {
          run: runId,
          error: `Step "${step.stepLabel}" failed: ${result.failed}`,
        }).catch(() => {});
        return;
      }

      if (result.manual) {
        // Suspend the run — human must advance via ProcessRun/resume.
        await kernel.invokeConcept('urn:clef/ProcessRun', 'suspend', { run: runId }).catch(() => {});
        return;
      }

      // Thread step output into the running scope for downstream steps
      Object.assign(scope, result.output);

      await kernel.invokeConcept('urn:clef/StepRun', 'complete', {
        step: stepRunId,
        output: JSON.stringify(result.output),
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
