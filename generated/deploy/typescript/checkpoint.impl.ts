// Checkpoint Concept Implementation
// Capture and restore complete process state snapshots for recovery,
// time-travel debugging, and audit.
import type { ConceptStorage } from "@clef/runtime";
import type { CheckpointHandler } from "./checkpoint.handler";

const RELATION = "checkpoint";
const RUN_INDEX_RELATION = "checkpoint_run_index";

let checkpointCounter = 0;
function nextCheckpointId(): string {
  checkpointCounter += 1;
  return `ckpt-${Date.now()}-${String(checkpointCounter).padStart(4, "0")}`;
}

export const checkpointHandler: CheckpointHandler = {
  async capture(input, storage) {
    const { runRef, runState, variablesSnapshot, tokenSnapshot, eventCursor } = input;

    const checkpointId = nextCheckpointId();
    const now = new Date().toISOString();

    await storage.put(RELATION, checkpointId, {
      checkpoint: checkpointId,
      runRef,
      timestamp: now,
      runState,
      variablesSnapshot,
      tokenSnapshot,
      eventCursor,
      label: "",
    });

    // Maintain a list of checkpoints per run for findLatest and prune
    const runIndex = await storage.get(RUN_INDEX_RELATION, runRef);
    const checkpointIds: string[] = runIndex
      ? JSON.parse(runIndex.checkpointIds as string)
      : [];
    checkpointIds.push(checkpointId);

    await storage.put(RUN_INDEX_RELATION, runRef, {
      runRef,
      checkpointIds: JSON.stringify(checkpointIds),
    });

    return { variant: "ok", checkpoint: checkpointId, timestamp: now };
  },

  async restore(input, storage) {
    const { checkpoint } = input;

    const record = await storage.get(RELATION, checkpoint);
    if (!record) {
      return { variant: "notFound", checkpoint };
    }

    return {
      variant: "ok",
      checkpoint,
      runState: record.runState as string,
      variablesSnapshot: record.variablesSnapshot as string,
      tokenSnapshot: record.tokenSnapshot as string,
      eventCursor: record.eventCursor as number,
    };
  },

  async findLatest(input, storage) {
    const { runRef } = input;

    const runIndex = await storage.get(RUN_INDEX_RELATION, runRef);
    if (!runIndex) {
      return { variant: "none", runRef };
    }

    const checkpointIds: string[] = JSON.parse(runIndex.checkpointIds as string);
    if (checkpointIds.length === 0) {
      return { variant: "none", runRef };
    }

    // The last checkpoint in the list is the most recent
    const latestId = checkpointIds[checkpointIds.length - 1];
    return { variant: "ok", checkpoint: latestId };
  },

  async prune(input, storage) {
    const { runRef, keepCount } = input;

    const runIndex = await storage.get(RUN_INDEX_RELATION, runRef);
    if (!runIndex) {
      return { variant: "ok", pruned: 0 };
    }

    const checkpointIds: string[] = JSON.parse(runIndex.checkpointIds as string);
    if (checkpointIds.length <= keepCount) {
      return { variant: "ok", pruned: 0 };
    }

    // Remove oldest checkpoints, keeping only the most recent keepCount
    const toRemove = checkpointIds.slice(0, checkpointIds.length - keepCount);
    const toKeep = checkpointIds.slice(checkpointIds.length - keepCount);

    for (const id of toRemove) {
      await storage.del(RELATION, id);
    }

    await storage.put(RUN_INDEX_RELATION, runRef, {
      runRef,
      checkpointIds: JSON.stringify(toKeep),
    });

    return { variant: "ok", pruned: toRemove.length };
  },
};
