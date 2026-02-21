// generated: comment.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./comment.types";

export interface CommentHandler {
  addComment(input: T.CommentAddCommentInput, storage: ConceptStorage):
    Promise<T.CommentAddCommentOutput>;
  reply(input: T.CommentReplyInput, storage: ConceptStorage):
    Promise<T.CommentReplyOutput>;
  publish(input: T.CommentPublishInput, storage: ConceptStorage):
    Promise<T.CommentPublishOutput>;
  unpublish(input: T.CommentUnpublishInput, storage: ConceptStorage):
    Promise<T.CommentUnpublishOutput>;
  delete(input: T.CommentDeleteInput, storage: ConceptStorage):
    Promise<T.CommentDeleteOutput>;
}
