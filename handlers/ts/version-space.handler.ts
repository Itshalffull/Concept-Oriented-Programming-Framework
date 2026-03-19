// ============================================================
// VersionSpace Handler
//
// Parallel, recursively composable overlays of entity state.
// Copy-on-write overrides, membership, merge/proposal workflows,
// and base reality promotion.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++idCounter}`;
}

export const versionSpaceHandler: ConceptHandler = {
  async fork(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;
    const parent = input.parent as string | null;
    const scope = input.scope as string | null;
    const visibility = input.visibility as string;

    // Validate parent exists if specified
    if (parent) {
      const parentRecord = await storage.get('spaces', parent);
      if (!parentRecord || parentRecord.status === 'archived') {
        return { variant: 'parent_not_found', parent };
      }
    }

    const id = nextId('vs');
    const now = new Date().toISOString();

    await storage.put('spaces', id, {
      id,
      name,
      parent: parent || null,
      root_scope: scope || null,
      visibility,
      status: 'active',
      created_by: (input as any).user || 'system',
      created_at: now,
      fork_point: null,
      children: [],
    });

    // Add as child of parent if nested
    if (parent) {
      const parentRecord = await storage.get('spaces', parent);
      if (parentRecord) {
        const children = (parentRecord.children as string[]) || [];
        children.push(id);
        await storage.put('spaces', parent, { ...parentRecord, children });
      }
    }

    // Add creator as owner member
    const memberId = nextId('member');
    await storage.put('members', memberId, {
      id: memberId,
      member_space: id,
      member_user: (input as any).user || 'system',
      member_role: 'owner',
    });

    return { variant: 'ok', space: id };
  },

  async enter(input: Record<string, unknown>, storage: ConceptStorage) {
    const space = input.space as string;
    const user = input.user as string;

    const record = await storage.get('spaces', space);
    if (!record) {
      return { variant: 'access_denied', user };
    }

    if (record.status === 'archived') {
      return { variant: 'archived', space };
    }

    // Check membership for private/shared spaces
    if (record.visibility === 'private' || record.visibility === 'shared') {
      const members = await storage.find('members', { member_space: space });
      const isMember = members.some((m: any) => m.member_user === user);
      if (!isMember) {
        return { variant: 'access_denied', user };
      }
    }

    return { variant: 'ok' };
  },

  async leave(input: Record<string, unknown>, _storage: ConceptStorage) {
    return { variant: 'ok' };
  },

  async write(input: Record<string, unknown>, storage: ConceptStorage) {
    const space = input.space as string;
    const entity_id = input.entity_id as string;
    const fields = input.fields as string;

    const spaceRecord = await storage.get('spaces', space);
    if (!spaceRecord) {
      return { variant: 'read_only', space, user: '' };
    }

    // Check for existing override
    const existingOverrides = await storage.find('override_entries', {
      override_space: space,
      override_entity_id: entity_id,
    });

    const now = new Date().toISOString();

    if (existingOverrides.length > 0) {
      // Update existing override
      const existing = existingOverrides[0];
      await storage.put('override_entries', existing.id as string, {
        ...existing,
        override_fields: fields,
        override_at: now,
      });
      return { variant: 'ok', override: existing.id as string };
    }

    // Create new override (copy-on-write)
    const overrideId = nextId('override');
    await storage.put('override_entries', overrideId, {
      id: overrideId,
      override_space: space,
      override_entity_id: entity_id,
      override_fields: fields,
      override_operation: 'modify',
      override_at: now,
    });

    return { variant: 'ok', override: overrideId };
  },

  async create_in_space(input: Record<string, unknown>, storage: ConceptStorage) {
    const space = input.space as string;
    const fields = input.fields as string;

    const entity_id = nextId('entity');
    const overrideId = nextId('override');
    const now = new Date().toISOString();

    await storage.put('override_entries', overrideId, {
      id: overrideId,
      override_space: space,
      override_entity_id: entity_id,
      override_fields: fields,
      override_operation: 'create',
      override_at: now,
    });

    return { variant: 'ok', override: overrideId, entity_id };
  },

  async delete_in_space(input: Record<string, unknown>, storage: ConceptStorage) {
    const space = input.space as string;
    const entity_id = input.entity_id as string;
    const now = new Date().toISOString();

    // Check for existing override and update it to a tombstone
    const existingOverrides = await storage.find('override_entries', {
      override_space: space,
      override_entity_id: entity_id,
    });

    if (existingOverrides.length > 0) {
      const existing = existingOverrides[0];
      await storage.put('override_entries', existing.id as string, {
        ...existing,
        override_fields: '',
        override_operation: 'delete',
        override_at: now,
      });
      return { variant: 'ok', override: existing.id as string };
    }

    const overrideId = nextId('override');
    await storage.put('override_entries', overrideId, {
      id: overrideId,
      override_space: space,
      override_entity_id: entity_id,
      override_fields: '',
      override_operation: 'delete',
      override_at: now,
    });

    return { variant: 'ok', override: overrideId };
  },

  async resolve(input: Record<string, unknown>, storage: ConceptStorage) {
    const space = input.space as string;
    const entity_id = input.entity_id as string;

    // Walk the ancestry chain: space -> parent -> ... -> base
    let currentSpace: string | null = space;
    const overrideChain: Array<{ fields: string; source: string }> = [];

    while (currentSpace) {
      const overrides = await storage.find('override_entries', {
        override_space: currentSpace,
        override_entity_id: entity_id,
      });

      if (overrides.length > 0) {
        const override = overrides[0];
        if (override.override_operation === 'delete') {
          return { variant: 'not_found', entity_id };
        }
        overrideChain.push({
          fields: override.override_fields as string,
          source: currentSpace,
        });
      }

      // Walk to parent
      const spaceRecord = await storage.get('spaces', currentSpace);
      currentSpace = spaceRecord?.parent as string | null;
    }

    if (overrideChain.length === 0) {
      // No overrides found anywhere in the chain — entity comes from base
      return { variant: 'ok', fields: '{}', source: 'base' };
    }

    // Merge overrides: most specific (current space) wins
    const merged = overrideChain[0];
    return { variant: 'ok', fields: merged.fields, source: merged.source };
  },

  async propose(input: Record<string, unknown>, storage: ConceptStorage) {
    const space = input.space as string;

    const record = await storage.get('spaces', space);
    if (!record) {
      return { variant: 'already_proposed', space };
    }

    if (record.status === 'proposed') {
      return { variant: 'already_proposed', space };
    }

    await storage.put('spaces', space, { ...record, status: 'proposed' });
    return { variant: 'ok' };
  },

  async merge(input: Record<string, unknown>, storage: ConceptStorage) {
    const space = input.space as string;

    const record = await storage.get('spaces', space);
    if (!record) {
      return { variant: 'conflicts', conflicts: 'Space not found' };
    }

    // Get all overrides in this space
    const overrides = await storage.find('override_entries', {
      override_space: space,
    });

    // Mark space as merged
    await storage.put('spaces', space, { ...record, status: 'merged' });

    return {
      variant: 'ok',
      merged_count: overrides.length,
      conflict_count: 0,
    };
  },

  async sync_spaces(input: Record<string, unknown>, storage: ConceptStorage) {
    const space_a = input.space_a as string;
    const space_b = input.space_b as string;

    const recordA = await storage.get('spaces', space_a);
    const recordB = await storage.get('spaces', space_b);

    if (!recordA || !recordB) {
      return { variant: 'incompatible_scope', space_a, space_b };
    }

    // Check scope compatibility
    if (recordA.root_scope && recordB.root_scope &&
        recordA.root_scope !== recordB.root_scope) {
      return { variant: 'incompatible_scope', space_a, space_b };
    }

    return { variant: 'ok', a_to_b_count: 0, b_to_a_count: 0, conflict_count: 0 };
  },

  async cherry_pick(input: Record<string, unknown>, storage: ConceptStorage) {
    const source = input.source as string;
    const target = input.target as string;
    const entity_id = input.entity_id as string;

    const sourceOverrides = await storage.find('override_entries', {
      override_space: source,
      override_entity_id: entity_id,
    });

    if (sourceOverrides.length === 0) {
      return { variant: 'not_overridden', source, entity_id };
    }

    const targetOverrides = await storage.find('override_entries', {
      override_space: target,
      override_entity_id: entity_id,
    });

    if (targetOverrides.length > 0) {
      return {
        variant: 'conflict',
        existing_override: targetOverrides[0].override_fields as string,
        incoming_override: sourceOverrides[0].override_fields as string,
      };
    }

    // Copy override to target
    const overrideId = nextId('override');
    const sourceOverride = sourceOverrides[0];
    await storage.put('override_entries', overrideId, {
      id: overrideId,
      override_space: target,
      override_entity_id: entity_id,
      override_fields: sourceOverride.override_fields,
      override_operation: sourceOverride.override_operation,
      override_at: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  async promote_to_base(input: Record<string, unknown>, storage: ConceptStorage) {
    const space = input.space as string;

    const record = await storage.get('spaces', space);
    if (!record) {
      return { variant: 'access_denied' };
    }

    // Check for active children
    const children = (record.children as string[]) || [];
    const activeChildren: string[] = [];
    for (const childId of children) {
      const child = await storage.get('spaces', childId);
      if (child && child.status !== 'archived' && child.status !== 'merged') {
        activeChildren.push(childId);
      }
    }

    if (activeChildren.length > 0) {
      return { variant: 'has_children', children: activeChildren };
    }

    // Snapshot old base
    const snapshotId = nextId('snapshot');
    await storage.put('snapshots', snapshotId, {
      id: snapshotId,
      snapshot_content_hash: 'base-' + new Date().toISOString(),
      snapshot_promoted_from: space,
      snapshot_timestamp: new Date().toISOString(),
      snapshot_label: `Base before promotion of ${record.name}`,
    });

    // Archive the promoted space
    await storage.put('spaces', space, { ...record, status: 'archived' });

    return { variant: 'ok', old_base_snapshot: snapshotId };
  },

  async rebase(input: Record<string, unknown>, storage: ConceptStorage) {
    const space = input.space as string;

    const overrides = await storage.find('override_entries', {
      override_space: space,
    });

    // In a real implementation, compare each override against current base
    // and dissolve redundant ones. For now, all are preserved.
    return {
      variant: 'ok',
      dissolved_count: 0,
      preserved_count: overrides.length,
    };
  },

  async diff(input: Record<string, unknown>, storage: ConceptStorage) {
    const space = input.space as string;

    const overrides = await storage.find('override_entries', {
      override_space: space,
    });

    const changes = overrides.map((o: any) => ({
      entity_id: o.override_entity_id,
      operation: o.override_operation,
      fields: o.override_fields,
    }));

    return { variant: 'ok', changes: JSON.stringify(changes) };
  },

  async archive(input: Record<string, unknown>, storage: ConceptStorage) {
    const space = input.space as string;

    const record = await storage.get('spaces', space);
    if (record) {
      await storage.put('spaces', space, { ...record, status: 'archived' });
    }

    return { variant: 'ok' };
  },

  async execute_in_space(input: Record<string, unknown>, storage: ConceptStorage) {
    const space = input.space as string;

    const record = await storage.get('spaces', space);
    if (!record || record.status === 'archived') {
      return { variant: 'space_not_found', space };
    }

    // The actual execution context setup would be handled by the sync engine
    // and VersionContext. This action signals that the space should be the
    // active context for the delegated action execution.
    return { variant: 'ok', result: JSON.stringify({ space, action: input.action, params: input.params }) };
  },
};

export default versionSpaceHandler;
