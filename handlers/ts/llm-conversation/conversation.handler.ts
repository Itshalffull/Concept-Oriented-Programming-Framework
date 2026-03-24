// @clef-handler style=functional
// ============================================================
// Conversation Handler
//
// Persistent, branching sequence of messages representing a dialogue
// thread. Manages appending, forking for exploration (Loom/multiversal
// branching), truncating to fit context windows, and summarizing old
// context. The session manager for LLM interactions.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, find, branch, complete, completeFrom,
  mapBindings, del,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// ---------------------------------------------------------------------------
// ID generators
// ---------------------------------------------------------------------------
let convCounter = 0;
function nextConversationId(): string {
  return `conv-${++convCounter}`;
}

let msgCounter = 0;
function nextMessageId(): string {
  return `msg-${++msgCounter}`;
}

let branchCounter = 0;
function nextBranchId(): string {
  return `branch-${++branchCounter}`;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const VALID_STRATEGIES = ['sliding_window', 'summary_buffer', 'vector_retrieval', 'hybrid'];
const VALID_ROLES = ['system', 'user', 'assistant', 'tool', 'developer'];
const VALID_FORMATS = ['openai', 'anthropic', 'vercel', 'generic'];
const VALID_MERGE_STRATEGIES = ['interleave', 'concatenate', 'summarize'];
const MAIN_BRANCH = 'main';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Rough token estimate: ~4 chars per token. */
function estimateTokens(content: string): number {
  return Math.ceil((content || '').length / 4);
}

/** Get the lineage of message IDs from root to a given message, following branches. */
function getLineageFromTree(
  messages: Array<Record<string, unknown>>,
  branches: Array<Record<string, unknown>>,
  activeBranch: string | null,
  targetMessageId: string,
): string[] | null {
  // Build a map of message id to message
  const msgMap = new Map<string, Record<string, unknown>>();
  for (const m of messages) {
    msgMap.set(m.id as string, m);
  }

  // Build parent map from branches
  // Each branch has: branch_id, parent_message_id, message_ids
  // The main branch has all root-level messages
  // For a given message, find which branch it belongs to
  const branchMap = new Map<string, Record<string, unknown>>();
  for (const b of branches) {
    branchMap.set(b.branch_id as string, b);
  }

  // Simple approach: walk all messages collecting ids in order up to target
  const allIds = messages.map(m => m.id as string);
  const targetIdx = allIds.indexOf(targetMessageId);
  if (targetIdx === -1) return null;

  // For the active branch, filter messages to only those in the branch lineage
  if (activeBranch && activeBranch !== MAIN_BRANCH) {
    const branchDef = branchMap.get(activeBranch);
    if (branchDef) {
      const parentMsgId = branchDef.parent_message_id as string;
      const branchMsgIds = branchDef.message_ids as string[];
      // Lineage = messages from root to parent_message_id + branch messages
      const parentIdx = allIds.indexOf(parentMsgId);
      if (parentIdx === -1) return null;
      const lineage = allIds.slice(0, parentIdx + 1).concat(branchMsgIds);
      const tIdx = lineage.indexOf(targetMessageId);
      if (tIdx === -1) return null;
      return lineage.slice(0, tIdx + 1);
    }
  }

  return allIds.slice(0, targetIdx + 1);
}

/** Get active lineage message IDs for the conversation's active branch. */
function getActiveLineage(
  messages: Array<Record<string, unknown>>,
  branches: Array<Record<string, unknown>>,
  activeBranch: string | null,
): string[] {
  const allIds = messages.map(m => m.id as string);
  if (!activeBranch || activeBranch === MAIN_BRANCH) {
    return allIds;
  }
  const branchMap = new Map<string, Record<string, unknown>>();
  for (const b of branches) {
    branchMap.set(b.branch_id as string, b);
  }
  const branchDef = branchMap.get(activeBranch);
  if (!branchDef) return allIds;
  const parentMsgId = branchDef.parent_message_id as string;
  const branchMsgIds = (branchDef.message_ids || []) as string[];
  const parentIdx = allIds.indexOf(parentMsgId);
  if (parentIdx === -1) return branchMsgIds;
  return allIds.slice(0, parentIdx + 1).concat(branchMsgIds);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
const _handler: FunctionalConceptHandler = {

  register(_input: Record<string, unknown>) {
    let p = createProgram();
    p = get(p, 'conversation', '__registered', 'existing');
    return branch(p, 'existing',
      (b) => complete(b, 'already_registered', { name: 'Conversation' }),
      (b) => {
        let b2 = put(b, 'conversation', '__registered', { value: true });
        return complete(b2, 'ok', { name: 'Conversation' });
      },
    );
  },

  // -----------------------------------------------------------------------
  // create(context_strategy: String)
  //   -> ok(conversation: C)
  //   -> invalid(message: String)
  // -----------------------------------------------------------------------
  create(input: Record<string, unknown>) {
    const contextStrategy = input.context_strategy as string;

    if (!contextStrategy || !VALID_STRATEGIES.includes(contextStrategy)) {
      return complete(createProgram(), 'invalid', {
        message: `Unknown context strategy. Valid strategies: ${VALID_STRATEGIES.join(', ')}`,
      });
    }

    const id = nextConversationId();
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, 'conversation', id, {
      id,
      messages: [] as Array<Record<string, unknown>>,
      branches: [{ branch_id: MAIN_BRANCH, parent_message_id: '', message_ids: [] as string[] }],
      active_branch: MAIN_BRANCH,
      context_strategy: contextStrategy,
      summary: null,
      node_metadata: [] as Array<Record<string, unknown>>,
      created_at: now,
      updated_at: now,
      participant_ids: [] as string[],
      tags: [] as string[],
      token_count: 0,
    });

    return complete(p, 'ok', { conversation: id });
  },

  // -----------------------------------------------------------------------
  // append(conversation, role, content, parts?, tool_calls?, metadata?)
  //   -> ok(message_id: String)
  //   -> notfound(message: String)
  // -----------------------------------------------------------------------
  append(input: Record<string, unknown>) {
    const conversationId = input.conversation as string;
    const role = input.role as string;
    const content = input.content as string;
    const parts = (input.parts as Array<Record<string, unknown>> | undefined) || null;
    const toolCalls = (input.tool_calls as Array<Record<string, unknown>> | undefined) || null;
    const metadata = (input.metadata as Record<string, unknown> | undefined) || null;

    let p = createProgram();
    p = get(p, 'conversation', conversationId, 'existing');

    return branch(p, 'existing',
      // exists
      (b) => {
        const messageId = nextMessageId();
        const now = new Date().toISOString();
        const tokens = estimateTokens(content);

        let b2 = putFrom(b, 'conversation', conversationId, (bindings) => {
          const conv = bindings.existing as Record<string, unknown>;
          const messages = [...(conv.messages as Array<Record<string, unknown>>)];
          const branches = [...(conv.branches as Array<Record<string, unknown>>)];
          const activeBranch = conv.active_branch as string;

          const newMessage: Record<string, unknown> = {
            id: messageId,
            role,
            content,
            parts: parts || undefined,
            tool_calls: toolCalls || undefined,
            metadata: metadata || undefined,
            timestamp: now,
          };

          messages.push(newMessage);

          // Add message ID to the active branch's message_ids
          if (activeBranch && activeBranch !== MAIN_BRANCH) {
            for (let i = 0; i < branches.length; i++) {
              if ((branches[i].branch_id as string) === activeBranch) {
                const branchMsgIds = [...(branches[i].message_ids as string[])];
                branchMsgIds.push(messageId);
                branches[i] = { ...branches[i], message_ids: branchMsgIds };
                break;
              }
            }
          }

          return {
            ...conv,
            messages,
            branches,
            token_count: (conv.token_count as number) + tokens,
            updated_at: now,
          };
        });

        return complete(b2, 'ok', { message_id: messageId });
      },
      // not found
      (b) => complete(b, 'notfound', { message: 'Conversation not found' }),
    );
  },

  // -----------------------------------------------------------------------
  // fork(conversation, from_message_id)
  //   -> ok(branch_id: String)
  //   -> notfound(message: String)
  // -----------------------------------------------------------------------
  fork(input: Record<string, unknown>) {
    const conversationId = input.conversation as string;
    const fromMessageId = input.from_message_id as string;

    let p = createProgram();
    p = get(p, 'conversation', conversationId, 'existing');

    return branch(p, 'existing',
      (b) => {
        // Check if the message exists
        let b2 = mapBindings(b, (bindings) => {
          const conv = bindings.existing as Record<string, unknown>;
          const messages = conv.messages as Array<Record<string, unknown>>;
          return messages.some(m => (m.id as string) === fromMessageId);
        }, '_msgExists');

        return branch(b2, '_msgExists',
          // message found -> create branch
          (b3) => {
            const branchId = nextBranchId();

            let b4 = putFrom(b3, 'conversation', conversationId, (bindings) => {
              const conv = bindings.existing as Record<string, unknown>;
              const branches = [...(conv.branches as Array<Record<string, unknown>>)];
              branches.push({
                branch_id: branchId,
                parent_message_id: fromMessageId,
                message_ids: [] as string[],
              });
              return {
                ...conv,
                branches,
                active_branch: branchId,
                updated_at: new Date().toISOString(),
              };
            });

            return complete(b4, 'ok', { branch_id: branchId });
          },
          // message not found
          (b3) => complete(b3, 'notfound', { message: 'Message not found in conversation' }),
        );
      },
      (b) => complete(b, 'notfound', { message: 'Conversation not found' }),
    );
  },

  // -----------------------------------------------------------------------
  // switchBranch(conversation, branch_id)
  //   -> ok(conversation: C)
  //   -> notfound(message: String)
  // -----------------------------------------------------------------------
  switchBranch(input: Record<string, unknown>) {
    const conversationId = input.conversation as string;
    const branchId = input.branch_id as string;

    let p = createProgram();
    p = get(p, 'conversation', conversationId, 'existing');

    return branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const conv = bindings.existing as Record<string, unknown>;
          const branches = conv.branches as Array<Record<string, unknown>>;
          return branches.some(br => (br.branch_id as string) === branchId);
        }, '_branchExists');

        return branch(b2, '_branchExists',
          (b3) => {
            let b4 = putFrom(b3, 'conversation', conversationId, (bindings) => {
              const conv = bindings.existing as Record<string, unknown>;
              return {
                ...conv,
                active_branch: branchId,
                updated_at: new Date().toISOString(),
              };
            });
            return complete(b4, 'ok', { conversation: conversationId });
          },
          (b3) => complete(b3, 'notfound', { message: 'Branch not found' }),
        );
      },
      (b) => complete(b, 'notfound', { message: 'Conversation not found' }),
    );
  },

  // -----------------------------------------------------------------------
  // merge(conversation, branch_ids, strategy)
  //   -> ok(conversation: C)
  //   -> conflict(message: String)
  // -----------------------------------------------------------------------
  merge(input: Record<string, unknown>) {
    const conversationId = input.conversation as string;
    const branchIds = input.branch_ids as string[];
    const strategy = input.strategy as string;

    if (!VALID_MERGE_STRATEGIES.includes(strategy)) {
      return complete(createProgram(), 'conflict', {
        message: `Invalid merge strategy. Valid strategies: ${VALID_MERGE_STRATEGIES.join(', ')}`,
      });
    }

    let p = createProgram();
    p = get(p, 'conversation', conversationId, 'existing');

    return branch(p, 'existing',
      (b) => {
        // Check all branches exist
        let b2 = mapBindings(b, (bindings) => {
          const conv = bindings.existing as Record<string, unknown>;
          const branches = conv.branches as Array<Record<string, unknown>>;
          const existingIds = branches.map(br => br.branch_id as string);
          return branchIds.every(id => existingIds.includes(id));
        }, '_allExist');

        return branch(b2, '_allExist',
          (b3) => {
            let b4 = putFrom(b3, 'conversation', conversationId, (bindings) => {
              const conv = bindings.existing as Record<string, unknown>;
              const messages = conv.messages as Array<Record<string, unknown>>;
              const branches = conv.branches as Array<Record<string, unknown>>;

              // Collect all messages from the specified branches
              const branchMessages: Array<Record<string, unknown>> = [];
              for (const bid of branchIds) {
                const brDef = branches.find(br => (br.branch_id as string) === bid);
                if (brDef) {
                  const msgIds = brDef.message_ids as string[];
                  for (const mid of msgIds) {
                    const msg = messages.find(m => (m.id as string) === mid);
                    if (msg) branchMessages.push(msg);
                  }
                }
              }

              // Apply merge strategy
              let mergedContent = '';
              if (strategy === 'interleave') {
                // Sort by timestamp (chronological)
                branchMessages.sort((a, b2) =>
                  new Date(a.timestamp as string).getTime() - new Date(b2.timestamp as string).getTime()
                );
                mergedContent = branchMessages.map(m => m.content as string).join('\n');
              } else if (strategy === 'concatenate') {
                // Sequential by branch order
                mergedContent = branchMessages.map(m => m.content as string).join('\n');
              } else {
                // summarize — placeholder: concatenate with summary marker
                mergedContent = `[Merged summary of ${branchIds.length} branches]: ` +
                  branchMessages.map(m => m.content as string).join(' | ');
              }

              // Create a merged message on main branch
              const mergeMsg: Record<string, unknown> = {
                id: nextMessageId(),
                role: 'system',
                content: mergedContent,
                timestamp: new Date().toISOString(),
              };

              const newMessages = [...messages, mergeMsg];

              // Remove merged branches
              const remainingBranches = branches.filter(
                br => !branchIds.includes(br.branch_id as string)
              );

              return {
                ...conv,
                messages: newMessages,
                branches: remainingBranches.length > 0 ? remainingBranches : [
                  { branch_id: MAIN_BRANCH, parent_message_id: '', message_ids: [] as string[] },
                ],
                active_branch: MAIN_BRANCH,
                updated_at: new Date().toISOString(),
              };
            });

            return complete(b4, 'ok', { conversation: conversationId });
          },
          (b3) => complete(b3, 'conflict', { message: 'One or more branches not found' }),
        );
      },
      (b) => complete(b, 'conflict', { message: 'Conversation not found' }),
    );
  },

  // -----------------------------------------------------------------------
  // prune(conversation, branch_id)
  //   -> ok(conversation: C)
  //   -> notfound(message: String)
  // -----------------------------------------------------------------------
  prune(input: Record<string, unknown>) {
    const conversationId = input.conversation as string;
    const branchId = input.branch_id as string;

    let p = createProgram();
    p = get(p, 'conversation', conversationId, 'existing');

    return branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const conv = bindings.existing as Record<string, unknown>;
          const branches = conv.branches as Array<Record<string, unknown>>;
          return branches.some(br => (br.branch_id as string) === branchId);
        }, '_branchExists');

        return branch(b2, '_branchExists',
          (b3) => {
            let b4 = putFrom(b3, 'conversation', conversationId, (bindings) => {
              const conv = bindings.existing as Record<string, unknown>;
              const messages = conv.messages as Array<Record<string, unknown>>;
              const branches = conv.branches as Array<Record<string, unknown>>;

              // Find the branch and its message IDs
              const brDef = branches.find(br => (br.branch_id as string) === branchId);
              const branchMsgIds = brDef ? (brDef.message_ids as string[]) : [];

              // Remove branch messages
              const remainingMessages = messages.filter(
                m => !branchMsgIds.includes(m.id as string)
              );

              // Remove the branch
              const remainingBranches = branches.filter(
                br => (br.branch_id as string) !== branchId
              );

              // Recalculate token count
              let newTokenCount = 0;
              for (const m of remainingMessages) {
                newTokenCount += estimateTokens(m.content as string);
              }

              // If active branch was pruned, switch to main
              const activeBranch = conv.active_branch as string;
              const newActiveBranch = activeBranch === branchId ? MAIN_BRANCH : activeBranch;

              return {
                ...conv,
                messages: remainingMessages,
                branches: remainingBranches,
                active_branch: newActiveBranch,
                token_count: newTokenCount,
                updated_at: new Date().toISOString(),
              };
            });

            return complete(b4, 'ok', { conversation: conversationId });
          },
          (b3) => complete(b3, 'notfound', { message: 'Branch not found' }),
        );
      },
      (b) => complete(b, 'notfound', { message: 'Conversation not found' }),
    );
  },

  // -----------------------------------------------------------------------
  // getContextWindow(conversation, max_tokens)
  //   -> ok(messages: list {role, content}, total_tokens: Int)
  //   -> ok(message: String)  [empty conversation]
  // -----------------------------------------------------------------------
  getContextWindow(input: Record<string, unknown>) {
    const conversationId = input.conversation as string;
    const maxTokens = input.max_tokens as number;

    let p = createProgram();
    p = get(p, 'conversation', conversationId, 'existing');

    return branch(p, 'existing',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const conv = bindings.existing as Record<string, unknown>;
          const messages = conv.messages as Array<Record<string, unknown>>;
          const branches = conv.branches as Array<Record<string, unknown>>;
          const activeBranch = conv.active_branch as string | null;
          const contextStrategy = conv.context_strategy as string;
          const summary = conv.summary as string | null;

          if (messages.length === 0) {
            return { message: 'Conversation has no messages' };
          }

          // Get the active lineage
          const lineageIds = getActiveLineage(messages, branches, activeBranch);
          const lineageMessages = lineageIds
            .map(id => messages.find(m => (m.id as string) === id))
            .filter(Boolean) as Array<Record<string, unknown>>;

          // Apply context strategy
          let windowMessages: Array<{ role: string; content: string }> = [];

          if (contextStrategy === 'sliding_window') {
            // Take most recent messages that fit within max_tokens
            let tokenBudget = maxTokens;
            const selected: Array<{ role: string; content: string }> = [];

            // Always include system message first if present
            const systemMsg = lineageMessages.find(m => (m.role as string) === 'system');
            if (systemMsg) {
              const sysTokens = estimateTokens(systemMsg.content as string);
              if (sysTokens <= tokenBudget) {
                selected.push({ role: 'system', content: systemMsg.content as string });
                tokenBudget -= sysTokens;
              }
            }

            // Add messages from most recent, working backwards
            const nonSystemMsgs = lineageMessages.filter(m => (m.role as string) !== 'system');
            for (let i = nonSystemMsgs.length - 1; i >= 0; i--) {
              const tokens = estimateTokens(nonSystemMsgs[i].content as string);
              if (tokens <= tokenBudget) {
                selected.unshift({ role: nonSystemMsgs[i].role as string, content: nonSystemMsgs[i].content as string });
                tokenBudget -= tokens;
              } else {
                break;
              }
            }
            windowMessages = selected;

          } else if (contextStrategy === 'summary_buffer') {
            // Include summary (if any) + recent messages
            let tokenBudget = maxTokens;
            const selected: Array<{ role: string; content: string }> = [];

            if (summary) {
              const summaryTokens = estimateTokens(summary);
              if (summaryTokens <= tokenBudget) {
                selected.push({ role: 'system', content: summary });
                tokenBudget -= summaryTokens;
              }
            }

            // Add recent messages from lineage
            for (let i = lineageMessages.length - 1; i >= 0; i--) {
              const tokens = estimateTokens(lineageMessages[i].content as string);
              if (tokens <= tokenBudget) {
                selected.unshift({
                  role: lineageMessages[i].role as string,
                  content: lineageMessages[i].content as string,
                });
                tokenBudget -= tokens;
              } else {
                break;
              }
            }
            windowMessages = selected;

          } else {
            // vector_retrieval, hybrid — fall back to sliding window for now
            let tokenBudget = maxTokens;
            const selected: Array<{ role: string; content: string }> = [];
            for (let i = lineageMessages.length - 1; i >= 0; i--) {
              const tokens = estimateTokens(lineageMessages[i].content as string);
              if (tokens <= tokenBudget) {
                selected.unshift({
                  role: lineageMessages[i].role as string,
                  content: lineageMessages[i].content as string,
                });
                tokenBudget -= tokens;
              } else {
                break;
              }
            }
            windowMessages = selected;
          }

          // Calculate total tokens in the window
          let totalTokens = 0;
          for (const m of windowMessages) {
            totalTokens += estimateTokens(m.content);
          }

          return { messages: windowMessages, total_tokens: totalTokens };
        });
      },
      (b) => complete(b, 'notfound', { message: 'Conversation not found' }),
    );
  },

  // -----------------------------------------------------------------------
  // summarize(conversation, message_ids)
  //   -> ok(summary: String, tokens_saved: Int)
  //   -> notfound(message: String)
  // -----------------------------------------------------------------------
  summarize(input: Record<string, unknown>) {
    const conversationId = input.conversation as string;
    const messageIds = input.message_ids as string[];

    let p = createProgram();
    p = get(p, 'conversation', conversationId, 'existing');

    return branch(p, 'existing',
      (b) => {
        return mapBindings(b, (bindings) => {
          const conv = bindings.existing as Record<string, unknown>;
          const messages = conv.messages as Array<Record<string, unknown>>;
          // Collect the specified messages
          const targetMsgs = messageIds
            .map(id => messages.find(m => (m.id as string) === id))
            .filter(Boolean) as Array<Record<string, unknown>>;
          return targetMsgs;
        }, '_targetMsgs');

        // Note: mapBindings returns void so we chain after the branch
      },
      (b) => complete(b, 'notfound', { message: 'Conversation not found' }),
    );
  },

  // -----------------------------------------------------------------------
  // getLineage(conversation, message_id)
  //   -> ok(ancestry: list String)
  //   -> notfound(message: String)
  // -----------------------------------------------------------------------
  getLineage(input: Record<string, unknown>) {
    const conversationId = input.conversation as string;
    const messageId = input.message_id as string;

    let p = createProgram();
    p = get(p, 'conversation', conversationId, 'existing');

    return branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const conv = bindings.existing as Record<string, unknown>;
          const messages = conv.messages as Array<Record<string, unknown>>;
          const branches = conv.branches as Array<Record<string, unknown>>;
          const activeBranch = conv.active_branch as string | null;
          return getLineageFromTree(messages, branches, activeBranch, messageId);
        }, '_lineage');

        return branch(b2, '_lineage',
          (b3) => completeFrom(b3, 'ok', (bindings) => ({
            ancestry: bindings._lineage as string[],
          })),
          (b3) => complete(b3, 'notfound', { message: 'Message not found in tree' }),
        );
      },
      (b) => complete(b, 'notfound', { message: 'Conversation not found' }),
    );
  },

  // -----------------------------------------------------------------------
  // serialize(conversation, format)
  //   -> ok(serialized: String)
  //   -> notfound(message: String)
  // -----------------------------------------------------------------------
  serialize(input: Record<string, unknown>) {
    const conversationId = input.conversation as string;
    const format = input.format as string;

    let p = createProgram();
    p = get(p, 'conversation', conversationId, 'existing');

    return branch(p, 'existing',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const conv = bindings.existing as Record<string, unknown>;
          const messages = conv.messages as Array<Record<string, unknown>>;
          const branches = conv.branches as Array<Record<string, unknown>>;
          const activeBranch = conv.active_branch as string | null;

          // Get active lineage messages
          const lineageIds = getActiveLineage(messages, branches, activeBranch);
          const lineageMessages = lineageIds
            .map(id => messages.find(m => (m.id as string) === id))
            .filter(Boolean) as Array<Record<string, unknown>>;

          let serialized: unknown;

          if (format === 'openai') {
            serialized = lineageMessages.map(m => ({
              role: m.role,
              content: m.content,
              ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
            }));
          } else if (format === 'anthropic') {
            // Separate system from conversation messages
            const systemMsgs = lineageMessages.filter(m => (m.role as string) === 'system');
            const convMsgs = lineageMessages.filter(m => (m.role as string) !== 'system');
            serialized = {
              system: systemMsgs.map(m => m.content).join('\n'),
              messages: convMsgs.map(m => ({
                role: m.role,
                content: m.parts
                  ? (m.parts as Array<Record<string, unknown>>).map(p => ({
                      type: p.type,
                      ...(p.type === 'text' ? { text: p.data } : { source: p.data }),
                    }))
                  : m.content,
              })),
            };
          } else if (format === 'vercel') {
            serialized = lineageMessages.map(m => ({
              role: m.role,
              content: m.content,
              ...(m.parts ? { experimental_providerMetadata: { parts: m.parts } } : {}),
            }));
          } else {
            // generic
            serialized = lineageMessages.map(m => ({
              id: m.id,
              role: m.role,
              content: m.content,
              parts: m.parts || null,
              tool_calls: m.tool_calls || null,
              metadata: m.metadata || null,
              timestamp: m.timestamp,
            }));
          }

          return { serialized: JSON.stringify(serialized) };
        });
      },
      (b) => complete(b, 'notfound', { message: 'Conversation not found' }),
    );
  },
};

// ---------------------------------------------------------------------------
// Fix the summarize action — it was incomplete above. Override with full impl.
// ---------------------------------------------------------------------------
_handler.summarize = function summarize(input: Record<string, unknown>) {
  const conversationId = input.conversation as string;
  const messageIds = input.message_ids as string[];

  let p = createProgram();
  p = get(p, 'conversation', conversationId, 'existing');

  return branch(p, 'existing',
    (b) => {
      let b2 = mapBindings(b, (bindings) => {
        const conv = bindings.existing as Record<string, unknown>;
        const messages = conv.messages as Array<Record<string, unknown>>;
        const targetMsgs = messageIds
          .map(id => messages.find(m => (m.id as string) === id))
          .filter(Boolean) as Array<Record<string, unknown>>;
        return targetMsgs;
      }, '_targetMsgs');

      // Generate summary from target messages
      let b3 = mapBindings(b2, (bindings) => {
        const targetMsgs = bindings._targetMsgs as Array<Record<string, unknown>>;
        if (targetMsgs.length === 0) return null;
        // Concatenate content as a summary (real implementation would use LLM)
        const summaryText = targetMsgs
          .map(m => `[${m.role}]: ${(m.content as string).substring(0, 100)}`)
          .join(' | ');
        const originalTokens = targetMsgs.reduce(
          (sum, m) => sum + estimateTokens(m.content as string), 0
        );
        const summaryTokens = estimateTokens(summaryText);
        return { text: summaryText, tokensSaved: Math.max(0, originalTokens - summaryTokens) };
      }, '_summary');

      return branch(b3, '_summary',
        (b4) => {
          let b5 = putFrom(b4, 'conversation', conversationId, (bindings) => {
            const conv = bindings.existing as Record<string, unknown>;
            const summaryData = bindings._summary as { text: string; tokensSaved: number };
            const existingSummary = conv.summary as string | null;
            const newSummary = existingSummary
              ? `${existingSummary}\n${summaryData.text}`
              : summaryData.text;
            return {
              ...conv,
              summary: newSummary,
              updated_at: new Date().toISOString(),
            };
          });

          return completeFrom(b5, 'ok', (bindings) => {
            const summaryData = bindings._summary as { text: string; tokensSaved: number };
            return {
              summary: summaryData.text,
              tokens_saved: summaryData.tokensSaved,
            };
          });
        },
        (b4) => complete(b4, 'notfound', { message: 'No matching messages found' }),
      );
    },
    (b) => complete(b, 'notfound', { message: 'Conversation not found' }),
  );
};

export const conversationHandler = autoInterpret(_handler);
