// generated: connectorcall.types.ts

export interface ConnectorCallInvokeInput {
  stepRef: string;
  connectorType: string;
  operation: string;
  input: string;
  idempotencyKey: string;
}

export type ConnectorCallInvokeOutput =
  | { variant: "ok"; call: string; stepRef: string }
  | { variant: "duplicate"; idempotencyKey: string };

export interface ConnectorCallMarkSuccessInput {
  call: string;
  output: string;
}

export type ConnectorCallMarkSuccessOutput =
  | { variant: "ok"; call: string; stepRef: string; output: string }
  | { variant: "notInvoking"; call: string };

export interface ConnectorCallMarkFailureInput {
  call: string;
  error: string;
}

export type ConnectorCallMarkFailureOutput =
  | { variant: "error"; call: string; stepRef: string; message: string }
  | { variant: "notInvoking"; call: string };

export interface ConnectorCallGetResultInput {
  call: string;
}

export type ConnectorCallGetResultOutput =
  | { variant: "ok"; call: string; status: string; output: string }
  | { variant: "notFound"; call: string };
