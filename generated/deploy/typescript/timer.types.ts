// generated: timer.types.ts

export interface TimerSetTimerInput {
  runRef: string;
  timerType: string;
  specification: string;
  purposeTag: string;
  contextRef: string;
}

export type TimerSetTimerOutput =
  | { variant: "ok"; timer: string; runRef: string; nextFireAt: string }
  | { variant: "invalidSpec"; specification: string };

export interface TimerFireInput {
  timer: string;
}

export type TimerFireOutput =
  | { variant: "ok"; timer: string; runRef: string; purposeTag: string; contextRef: string }
  | { variant: "notActive"; timer: string };

export interface TimerCancelInput {
  timer: string;
}

export type TimerCancelOutput =
  | { variant: "ok"; timer: string }
  | { variant: "notActive"; timer: string };

export interface TimerResetInput {
  timer: string;
  specification: string;
}

export type TimerResetOutput =
  { variant: "ok"; timer: string; nextFireAt: string };
