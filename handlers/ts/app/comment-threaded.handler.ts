// @migrated dsl-constructs 2026-03-18
// Comment Concept Implementation (Content Kit - Threaded Discussion)
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, del, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

export const commentThreadedHandler: FunctionalConceptHandler = {
  addComment(input: Record<string, unknown>) {
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
    const comment = input.comment as string;
    const parent = input.parent as string;
    const content = input.content as string;
    const author = input.author as string;

    let p = createProgram();
    p = spGet(p, 'comment', parent, 'parentRecord');
    // threadPath constructed at runtime from parent binding
    p = put(p, 'comment', comment, {
      comment, entity: '', content, author,
      parent,
      threadPath: `/${parent}/${comment}`,
      published: false,
    });
    return complete(p, 'ok', { comment }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
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

  delete(input: Record<string, unknown>) {
    const comment = input.comment as string;

    let p = createProgram();
    p = spGet(p, 'comment', comment, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = del(b, 'comment', comment);
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Comment not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
