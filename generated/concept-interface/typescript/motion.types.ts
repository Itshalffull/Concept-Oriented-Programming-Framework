// generated: motion.types.ts

export interface MotionDefineDurationInput {
  motion: string;
  name: string;
  ms: number;
}

export type MotionDefineDurationOutput =
  { variant: "ok"; motion: string }
  | { variant: "invalid"; message: string };

export interface MotionDefineEasingInput {
  motion: string;
  name: string;
  value: string;
}

export type MotionDefineEasingOutput =
  { variant: "ok"; motion: string }
  | { variant: "invalid"; message: string };

export interface MotionDefineTransitionInput {
  motion: string;
  name: string;
  config: string;
}

export type MotionDefineTransitionOutput =
  { variant: "ok"; motion: string }
  | { variant: "invalid"; message: string };

