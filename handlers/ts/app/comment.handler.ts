// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Comment Concept Implementation (Content Kit - Threaded Discussion)
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, putFrom, del, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _commentHandler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const comment = input.comment as string;
    const body = input.body as string;
    const target = input.target as string;
    const author = input.author as string;

    let p = createProgram();
    p = put(p, 'comment', comment, { comment, body, target, author });
    return complete(p, 'ok', { comment }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  list(input: Record<string, unknown>) {
    const target = input.target as string | undefined;

    let p = createProgram();
    if (target) {
      p = find(p, 'comment', { target }, 'allComments');
    } else {
      p = find(p, 'comment', {}, 'allComments');
    }
    p = completeFrom(p, 'ok', (bindings) => {
      const allComments = (bindings.allComments as Array<Record<string, unknown>>) || [];
      return { comments: JSON.stringify(allComments.map(r => ({
        comment: r.comment, body: r.body, target: r.target, author: r.author,
      }))) };
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  addComment(input: Record<string, unknown>) {
    if (!input.comment || (typeof input.comment === 'string' && (input.comment as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'comment is required' }) as StorageProgram<Result>;
    }
    const comment = input.comment as string;
    const entity = input.entity as string;
    const content = input.content as string;
    const author = input.author as string;

    const threadPath = `/${comment}`;

    let p = createProgram();
    p = put(p, 'comment', comment, {
      comment, entity, content, author,
      parent: '',
      threadPath,
      published: false,
    });
    return complete(p, 'ok', { comment }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  reply(input: Record<string, unknown>) {
    if (!input.parent || (typeof input.parent === 'string' && (input.parent as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'parent is required' }) as StorageProgram<Result>;
    }
    const comment = input.comment as string;
    const parent = input.parent as string;
    const content = input.content as string;
    const author = input.author as string;

    let p = createProgram();
    p = spGet(p, 'comment', parent, 'parentRecord');
    p = mapBindings(p, (bindings) => {
      const parentRec = bindings.parentRecord as Record<string, unknown> | null | undefined;
      if (!parentRec) return null;
      const parentThreadPath = (parentRec.threadPath as string) || `/${parent}`;
      return {
        comment,
        entity: (parentRec.entity as string) || '',
        content,
        author,
        parent,
        threadPath: `${parentThreadPath}/${comment}`,
        published: false,
      };
    }, '_replyRecord');
    return branch(p, 'parentRecord',
      (b) => {
        let b2 = putFrom(b, 'comment', comment, (bindings) => bindings._replyRecord as Record<string, unknown>);
        return complete(b2, 'ok', { comment });
      },
      (b) => complete(b, 'error', { message: `parent not found: ${parent}` }),
    ) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  publish(input: Record<string, unknown>) {
    const comment = input.comment as string;

    let p = createProgram();
    p = spGet(p, 'comment', comment, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'comment', comment, { published: true });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Comment not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  unpublish(input: Record<string, unknown>) {
    const comment = input.comment as string;

    let p = createProgram();
    p = spGet(p, 'comment', comment, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'comment', comment, { published: false });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Comment not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  listByEntity(input: Record<string, unknown>) {
    const entity = input.entity as string;

    let p = createProgram();
    p = find(p, 'comment', { entity }, 'allComments');
    p = mapBindings(p, (bindings) => {
      const all = (bindings.allComments as Array<Record<string, unknown>>) || [];
      return all
        .slice()
        .sort((a, b) => {
          const pa = (a.threadPath as string) || '';
          const pb = (b.threadPath as string) || '';
          return pa < pb ? -1 : pa > pb ? 1 : 0;
        })
        .map((r) => r.comment as string);
    }, 'sortedComments');
    return completeFrom(p, 'ok', (bindings) => ({
      comments: bindings.sortedComments as string[],
    })) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  delete(input: Record<string, unknown>) {
    const comment = input.comment as string;

    let p = createProgram();
    p = spGet(p, 'comment', comment, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = del(b, 'comment', comment);
        return complete(b2, 'ok', { comment });
      },
      (b) => complete(b, 'notfound', { message: 'Comment not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const commentHandler = autoInterpret(_commentHandler);

