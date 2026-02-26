// generated: comment.types.ts

export interface CommentAddCommentInput {
  comment: string;
  entity: string;
  content: string;
  author: string;
}

export type CommentAddCommentOutput =
  { variant: "ok"; comment: string };

export interface CommentReplyInput {
  comment: string;
  parent: string;
  content: string;
  author: string;
}

export type CommentReplyOutput =
  { variant: "ok"; comment: string };

export interface CommentPublishInput {
  comment: string;
}

export type CommentPublishOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface CommentUnpublishInput {
  comment: string;
}

export type CommentUnpublishOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface CommentDeleteInput {
  comment: string;
}

export type CommentDeleteOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

