// @clef-handler style=functional
// AgentTeam Concept Implementation
// Multi-agent group coordination. Manages topology selection, task
// delegation, result synthesis, and conflict escalation. Five topologies:
// hierarchical, pipeline, peer_to_peer, hub_and_spoke, blackboard.
// See Architecture doc for concept spec details.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(prefix: string = 'agent-team'): string {
  return `${prefix}-${++idCounter}`;
}

const VALID_TOPOLOGIES = new Set(['hierarchical', 'pipeline', 'peer_to_peer', 'hub_and_spoke', 'blackboard']);
const VALID_PROTOCOLS = new Set(['contract_net', 'voting', 'confidence_based', 'round_robin']);

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'AgentTeam' }) as StorageProgram<Result>;
  },

  assemble(input: Record<string, unknown>) {
    const name = input.name as string;
    const members = input.members as Array<{ agent_id: string; role_id: string }>;
    const topology = input.topology as string;
    const protocol = input.protocol as string;

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!topology || !VALID_TOPOLOGIES.has(topology)) {
      return complete(createProgram(), 'invalid', { message: `Unknown topology: ${topology}. Valid: ${[...VALID_TOPOLOGIES].join(', ')}` }) as StorageProgram<Result>;
    }
    if (!protocol || !VALID_PROTOCOLS.has(protocol)) {
      return complete(createProgram(), 'invalid', { message: `Unknown protocol: ${protocol}. Valid: ${[...VALID_PROTOCOLS].join(', ')}` }) as StorageProgram<Result>;
    }
    if (!members || !Array.isArray(members) || members.length === 0) {
      return complete(createProgram(), 'invalid', { message: 'members are required' }) as StorageProgram<Result>;
    }

    const id = nextId();
    let p = createProgram();
    p = put(p, 'team', id, {
      id,
      name,
      members,
      topology,
      protocol,
      task_queue: [],
      results: [],
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { team: id }) as StorageProgram<Result>;
  },

  delegate(input: Record<string, unknown>) {
    const team = input.team as string;
    const task = input.task as string;

    if (!team || (team as string).trim() === '') {
      return complete(createProgram(), 'ok', { message: 'team is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'team', team, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'ok', { message: 'Team not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'team', team, 'teamData');

        const taskId = nextId('task');

        b = putFrom(b, 'team', team, (bindings) => {
          const data = bindings.teamData as Record<string, unknown>;
          const members = data.members as Array<{ agent_id: string; role_id: string }>;
          const taskQueue = [...((data.task_queue || []) as Array<Record<string, unknown>>)];
          const topology = data.topology as string;

          let assignedTo: string | null = null;
          if (members.length > 0) {
            if (topology === 'pipeline') {
              assignedTo = members[0].agent_id;
            } else if (topology === 'hierarchical') {
              assignedTo = members[0].agent_id;
            } else {
              assignedTo = members[Math.floor(Math.random() * members.length)].agent_id;
            }
          }

          taskQueue.push({
            task_id: taskId,
            description: task,
            assigned_to: assignedTo,
            status: 'assigned',
          });

          return { ...data, task_queue: taskQueue };
        });

        return completeFrom(b, 'ok', (bindings) => {
          const data = bindings.teamData as Record<string, unknown>;
          const members = data.members as Array<{ agent_id: string; role_id: string }>;
          if (members.length === 0) {
            return { message: 'No team member can handle this task' };
          }
          const topology = data.topology as string;
          let agentId: string;
          if (topology === 'pipeline' || topology === 'hierarchical') {
            agentId = members[0].agent_id;
          } else {
            agentId = members[0].agent_id;
          }
          return { assignment: { agent_id: agentId, task_id: taskId } };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  synthesize(input: Record<string, unknown>) {
    const team = input.team as string;
    const taskId = input.task_id as string;

    if (!team || (team as string).trim() === '') {
      return complete(createProgram(), 'ok', { pending_agents: [] }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'team', team, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'ok', { pending_agents: [] }),
      (() => {
        let b = createProgram();
        b = get(b, 'team', team, 'teamData');
        return completeFrom(b, 'ok', (bindings) => {
          const data = bindings.teamData as Record<string, unknown>;
          const results = (data.results || []) as Array<Record<string, unknown>>;
          const taskResults = results.filter(r => r.task_id === taskId);

          if (taskResults.length === 0) {
            const members = data.members as Array<{ agent_id: string }>;
            return { pending_agents: members.map(m => m.agent_id) };
          }

          const contributors = taskResults.map(r => r.agent_id as string);
          const mergedResult = taskResults.map(r => r.result as string).join('\n---\n');

          return { result: mergedResult, contributors };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  resolveConflict(input: Record<string, unknown>) {
    const team = input.team as string;
    const taskId = input.task_id as string;

    if (!team || (team as string).trim() === '') {
      return complete(createProgram(), 'ok', { message: 'Consensus could not be reached' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'team', team, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'ok', { message: 'Team not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'team', team, 'teamData');
        return completeFrom(b, 'ok', (bindings) => {
          const data = bindings.teamData as Record<string, unknown>;
          const results = (data.results || []) as Array<Record<string, unknown>>;
          const taskResults = results.filter(r => r.task_id === taskId);

          if (taskResults.length < 2) {
            return { message: 'Consensus could not be reached' };
          }

          return {
            resolution: taskResults[0].result as string,
            method: 'confidence_based',
          };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  addMember(input: Record<string, unknown>) {
    const team = input.team as string;
    const agentId = input.agent_id as string;
    const roleId = input.role_id as string;

    if (!team || (team as string).trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'team is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'team', team, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Team not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'team', team, 'teamData');
        b = putFrom(b, 'team', team, (bindings) => {
          const data = bindings.teamData as Record<string, unknown>;
          const members = [...((data.members || []) as Array<Record<string, unknown>>)];
          members.push({ agent_id: agentId, role_id: roleId });
          return { ...data, members };
        });
        return complete(b, 'ok', { team });
      })(),
    ) as StorageProgram<Result>;
  },

  removeMember(input: Record<string, unknown>) {
    const team = input.team as string;
    const agentId = input.agent_id as string;

    if (!team || (team as string).trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'team is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'team', team, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Team not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'team', team, 'teamData');

        b = mapBindings(b, (bindings) => {
          const data = bindings.teamData as Record<string, unknown>;
          const members = (data.members || []) as Array<{ agent_id: string }>;
          return members.some(m => m.agent_id === agentId);
        }, '_found');

        return branch(b,
          (bindings) => !bindings._found,
          complete(createProgram(), 'notfound', { message: 'Agent not in team' }),
          (() => {
            let c = createProgram();
            c = get(c, 'team', team, 'teamData2');
            c = putFrom(c, 'team', team, (bindings) => {
              const data = bindings.teamData2 as Record<string, unknown>;
              const members = (data.members || []) as Array<{ agent_id: string; role_id: string }>;
              return { ...data, members: members.filter(m => m.agent_id !== agentId) };
            });
            return complete(c, 'ok', { team });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  getStatus(input: Record<string, unknown>) {
    const team = input.team as string;

    let p = createProgram();
    p = get(p, 'team', team, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'ok', { members: [], pending_tasks: 0, completed_tasks: 0 }),
      (() => {
        let b = createProgram();
        b = get(b, 'team', team, 'teamData');
        return completeFrom(b, 'ok', (bindings) => {
          const data = bindings.teamData as Record<string, unknown>;
          const members = (data.members || []) as Array<{ agent_id: string; role_id: string }>;
          const taskQueue = (data.task_queue || []) as Array<Record<string, unknown>>;

          const memberStatus = members.map(m => {
            const currentTask = taskQueue.find(t =>
              t.assigned_to === m.agent_id && t.status === 'assigned'
            );
            return {
              agent_id: m.agent_id,
              role: m.role_id,
              current_task: currentTask ? currentTask.task_id as string : null,
            };
          });

          const pending = taskQueue.filter(t => t.status === 'assigned').length;
          const completed = taskQueue.filter(t => t.status === 'completed').length;

          return { members: memberStatus, pending_tasks: pending, completed_tasks: completed };
        });
      })(),
    ) as StorageProgram<Result>;
  },
};

export const agentTeamHandler = autoInterpret(_handler);
