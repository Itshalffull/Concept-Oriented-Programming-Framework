// generated: migration.types.ts

export interface MigrationPlanInput {
  concept: string;
  fromVersion: number;
  toVersion: number;
}

export type MigrationPlanOutput =
  { variant: "ok"; migration: string; steps: string[]; estimatedRecords: number }
  | { variant: "noMigrationNeeded"; concept: string }
  | { variant: "incompatible"; concept: string; reason: string };

export interface MigrationExpandInput {
  migration: string;
}

export type MigrationExpandOutput =
  { variant: "ok"; migration: string }
  | { variant: "failed"; migration: string; reason: string };

export interface MigrationMigrateInput {
  migration: string;
}

export type MigrationMigrateOutput =
  { variant: "ok"; migration: string; recordsMigrated: number }
  | { variant: "partial"; migration: string; migrated: number; failed: number; errors: string[] };

export interface MigrationContractInput {
  migration: string;
}

export type MigrationContractOutput =
  { variant: "ok"; migration: string }
  | { variant: "rollback"; migration: string };

export interface MigrationStatusInput {
  migration: string;
}

export type MigrationStatusOutput =
  { variant: "ok"; migration: string; phase: string; progress: number };

