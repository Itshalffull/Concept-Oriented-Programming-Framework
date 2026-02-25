// generated: swifttoolchain.types.ts

export interface SwiftToolchainResolveInput {
  platform: string;
  versionConstraint: string | undefined;
}

export type SwiftToolchainResolveOutput =
  { variant: "ok"; toolchain: string; swiftcPath: string; version: string; capabilities: string[] }
  | { variant: "notInstalled"; installHint: string }
  | { variant: "xcodeRequired"; reason: string };

export interface SwiftToolchainRegisterInput {}

export type SwiftToolchainRegisterOutput =
  { variant: "ok"; name: string; language: string; capabilities: string[] };
