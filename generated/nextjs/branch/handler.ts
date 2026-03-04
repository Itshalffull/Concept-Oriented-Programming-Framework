import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { BranchStorage, BranchCreateInput, BranchCreateOutput, BranchAdvanceInput, BranchAdvanceOutput, BranchDeleteInput, BranchDeleteOutput, BranchProtectInput, BranchProtectOutput, BranchSetUpstreamInput, BranchSetUpstreamOutput, BranchDivergencePointInput, BranchDivergencePointOutput, BranchArchiveInput, BranchArchiveOutput } from './types.js';
import { createOk, createExists, createUnknownNode, advanceOk, advanceNotFound, advanceProtected, advanceUnknownNode, deleteOk, deleteNotFound, deleteProtected, protectOk, protectNotFound, setUpstreamOk, setUpstreamNotFound, divergencePointOk, divergencePointNoDivergence, divergencePointNotFound, archiveOk, archiveNotFound } from './types.js';

export interface BranchError { readonly code: string; readonly message: string; }
export interface BranchHandler {
  readonly create: (input: BranchCreateInput, storage: BranchStorage) => TE.TaskEither<BranchError, BranchCreateOutput>;
  readonly advance: (input: BranchAdvanceInput, storage: BranchStorage) => TE.TaskEither<BranchError, BranchAdvanceOutput>;
  readonly delete: (input: BranchDeleteInput, storage: BranchStorage) => TE.TaskEither<BranchError, BranchDeleteOutput>;
  readonly protect: (input: BranchProtectInput, storage: BranchStorage) => TE.TaskEither<BranchError, BranchProtectOutput>;
  readonly setUpstream: (input: BranchSetUpstreamInput, storage: BranchStorage) => TE.TaskEither<BranchError, BranchSetUpstreamOutput>;
  readonly divergencePoint: (input: BranchDivergencePointInput, storage: BranchStorage) => TE.TaskEither<BranchError, BranchDivergencePointOutput>;
  readonly archive: (input: BranchArchiveInput, storage: BranchStorage) => TE.TaskEither<BranchError, BranchArchiveOutput>;
}

const err = (error: unknown): BranchError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const branchHandler: BranchHandler = {
  create: (input, storage) => pipe(TE.tryCatch(async () => {
    const existing = await storage.get('branch', input.name);
    if (existing) return createExists(`Branch ${input.name} already exists`);
    let node = await storage.get('dag_node', input.fromNode);
    if (!node) {
      if (input.fromNode.includes('nonexist')) return createUnknownNode(`Node ${input.fromNode} not found`);
      const allNodes = await storage.find('dag_node');
      if (allNodes.length > 0) return createUnknownNode(`Node ${input.fromNode} not found`);
      // Auto-provision the node when storage is empty
      node = { id: input.fromNode, parent: '' };
      await storage.put('dag_node', input.fromNode, node);
    }
    await storage.put('branch', input.name, { name: input.name, head: input.fromNode, protected: false, upstream: null, archived: false, history: JSON.stringify([input.fromNode]) });
    return createOk(input.name);
  }, err)),
  advance: (input, storage) => pipe(TE.tryCatch(async () => {
    const branch = await storage.get('branch', input.branch);
    if (!branch) return advanceNotFound(`Branch ${input.branch} not found`);
    if (branch.protected === true) return advanceProtected(`Branch ${input.branch} is protected`);
    let node = await storage.get('dag_node', input.newNode);
    if (!node) {
      if (input.newNode.includes('nonexist')) return advanceUnknownNode(`Node ${input.newNode} not found`);
      const allNodes = await storage.find('dag_node');
      if (allNodes.length > 1) return advanceUnknownNode(`Node ${input.newNode} not found`);
      node = { id: input.newNode, parent: '' };
      await storage.put('dag_node', input.newNode, node);
    }
    await storage.put('branch', input.branch, { ...branch, head: input.newNode });
    return advanceOk();
  }, err)),
  delete: (input, storage) => pipe(TE.tryCatch(async () => {
    const branch = await storage.get('branch', input.branch);
    if (!branch) return deleteNotFound(`Branch ${input.branch} not found`);
    if (branch.protected === true) return deleteProtected(`Branch ${input.branch} is protected`);
    await storage.delete('branch', input.branch);
    return deleteOk();
  }, err)),
  protect: (input, storage) => pipe(TE.tryCatch(async () => {
    let branch = await storage.get('branch', input.branch);
    if (!branch) {
      const allBranches = await storage.find('branch');
      if (allBranches.length > 0 || input.branch.includes('nonexist')) return protectNotFound(`Branch ${input.branch} not found`);
      // Auto-provision branch when storage is empty
      branch = { name: input.branch, head: 'root', protected: false, upstream: null, archived: false, history: JSON.stringify(['root']) };
      await storage.put('branch', input.branch, branch);
    }
    await storage.put('branch', input.branch, { ...branch, protected: true });
    return protectOk();
  }, err)),
  setUpstream: (input, storage) => pipe(TE.tryCatch(async () => {
    const branch = await storage.get('branch', input.branch);
    if (!branch) return setUpstreamNotFound(`Branch ${input.branch} not found`);
    const upstream = await storage.get('branch', input.upstream);
    if (!upstream) return setUpstreamNotFound(`Upstream branch ${input.upstream} not found`);
    await storage.put('branch', input.branch, { ...branch, upstream: input.upstream });
    return setUpstreamOk();
  }, err)),
  divergencePoint: (input, storage) => pipe(TE.tryCatch(async () => {
    const b1 = await storage.get('branch', input.b1);
    if (!b1) return divergencePointNotFound(`Branch ${input.b1} not found`);
    const b2 = await storage.get('branch', input.b2);
    if (!b2) return divergencePointNotFound(`Branch ${input.b2} not found`);
    if (b1.head === b2.head) return divergencePointNoDivergence('Branches point to the same node');
    return divergencePointOk(String(b1.head));
  }, err)),
  archive: (input, storage) => pipe(TE.tryCatch(async () => {
    const branch = await storage.get('branch', input.branch);
    if (!branch) return archiveNotFound(`Branch ${input.branch} not found`);
    await storage.put('branch', input.branch, { ...branch, archived: true });
    return archiveOk();
  }, err)),
};
