// Last-Write-Wins conflict resolution by timestamp comparison
// Always auto-resolves by selecting the version with the most recent timestamp.
// Simple but risks silent data loss when concurrent writes occur.

export interface Conflict {
  entityId: string;
  versionA: Record<string, unknown>;
  versionB: Record<string, unknown>;
  ancestor?: Record<string, unknown>;
  fieldConflicts: string[];
  timestampA?: number;
  timestampB?: number;
}

export interface ResolverConfig {
  options?: Record<string, unknown>;
}

export interface Resolution {
  winner: Record<string, unknown>;
  strategy: string;
  details: Record<string, unknown>;
}

export const PROVIDER_ID = 'lww_timestamp';
export const PLUGIN_TYPE = 'conflict_resolver';

export class LwwTimestampResolverProvider {
  resolve(conflict: Conflict, _config: ResolverConfig): Resolution {
    const tsA = conflict.timestampA ?? 0;
    const tsB = conflict.timestampB ?? 0;

    const aWins = tsA >= tsB;
    const winner = aWins ? conflict.versionA : conflict.versionB;
    const winningTimestamp = aWins ? tsA : tsB;
    const losingTimestamp = aWins ? tsB : tsA;
    const margin = Math.abs(tsA - tsB);

    return {
      winner: { ...winner },
      strategy: 'lww_timestamp',
      details: {
        winningVersion: aWins ? 'A' : 'B',
        winningTimestamp,
        losingTimestamp,
        marginMs: margin,
        entityId: conflict.entityId,
        fieldsOverwritten: conflict.fieldConflicts,
        silentDataLossRisk: conflict.fieldConflicts.length > 0,
      },
    };
  }

  canAutoResolve(_conflict: Conflict): boolean {
    return true;
  }
}

export default LwwTimestampResolverProvider;
