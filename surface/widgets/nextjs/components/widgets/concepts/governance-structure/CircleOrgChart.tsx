import type { HTMLAttributes, ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface CircleMember {
  name: string;
  role: string;
}

export interface Circle {
  id: string;
  name: string;
  purpose: string;
  parentId?: string | undefined;
  members: CircleMember[];
  jurisdiction?: string | undefined;
  policies?: string[] | undefined;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

interface CircleTreeNode {
  circle: Circle;
  children: CircleTreeNode[];
}

function buildTree(circles: Circle[]): CircleTreeNode[] {
  const byId = new Map<string, CircleTreeNode>();
  for (const c of circles) {
    byId.set(c.id, { circle: c, children: [] });
  }
  const roots: CircleTreeNode[] = [];
  for (const c of circles) {
    const node = byId.get(c.id)!;
    if (c.parentId && byId.has(c.parentId)) {
      byId.get(c.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface CircleOrgChartProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  circles: Circle[];
  selectedCircleId?: string | undefined;
  layout?: 'tree' | 'nested' | 'radial';
  showPolicies?: boolean;
  showJurisdiction?: boolean;
  maxAvatars?: number;
  expandedIds?: string[];
}

/* ---------------------------------------------------------------------------
 * Recursive circle renderer
 * ------------------------------------------------------------------------- */

function renderCircleNode(
  node: CircleTreeNode,
  depth: number,
  selectedId: string | undefined,
  expandedSet: Set<string>,
  showPolicies: boolean,
  showJurisdiction: boolean,
  maxAvatars: number,
): ReactNode {
  const { circle, children } = node;
  const hasChildren = children.length > 0;
  const isExpanded = expandedSet.has(circle.id);
  const isSelected = selectedId === circle.id;
  const visibleMembers = circle.members.slice(0, maxAvatars);
  const overflowCount = Math.max(0, circle.members.length - maxAvatars);

  return (
    <div
      key={circle.id}
      role="treeitem"
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={isSelected}
      aria-label={`${circle.name}: ${circle.purpose}`}
      aria-level={depth + 1}
      data-part="circle-node"
      data-selected={isSelected ? 'true' : 'false'}
      data-id={circle.id}
      tabIndex={-1}
      style={{ paddingLeft: `${depth * 24}px` }}
    >
      {/* Expand/collapse indicator */}
      {hasChildren && (
        <span data-part="expand-toggle" aria-hidden="true">
          {isExpanded ? '\u25BC' : '\u25B6'}
        </span>
      )}

      {/* Circle label */}
      <span data-part="circle-label">{circle.name}</span>

      {/* Purpose */}
      <span data-part="circle-purpose" aria-hidden="true">{circle.purpose}</span>

      {/* Member count */}
      <span data-part="member-count">
        {`${circle.members.length} member${circle.members.length !== 1 ? 's' : ''}`}
      </span>

      {/* Member avatars row */}
      <div data-part="member-avatars">
        {visibleMembers.map((member, idx) => (
          <span
            key={idx}
            data-part="member-avatar"
            aria-label={`${member.name}, ${member.role}`}
            title={`${member.name} (${member.role})`}
          >
            {member.name.charAt(0).toUpperCase()}
          </span>
        ))}
        {overflowCount > 0 && (
          <span data-part="member-overflow" aria-label={`${overflowCount} more members`}>
            {`+${overflowCount}`}
          </span>
        )}
      </div>

      {/* Policy badges */}
      {showPolicies && circle.policies && circle.policies.length > 0 && (
        <div data-part="policies" data-visible="true">
          {circle.policies.map((policy, idx) => (
            <span key={idx} data-part="policy-badge">{policy}</span>
          ))}
        </div>
      )}

      {/* Jurisdiction tag */}
      {showJurisdiction && circle.jurisdiction && (
        <span data-part="jurisdiction" data-visible="true">{circle.jurisdiction}</span>
      )}

      {/* Nested child circles */}
      {hasChildren && isExpanded && (
        <div data-part="children" role="group" data-visible="true">
          {children.map((child) =>
            renderCircleNode(child, depth + 1, selectedId, expandedSet, showPolicies, showJurisdiction, maxAvatars),
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Component (Server Component)
 * ------------------------------------------------------------------------- */

export default function CircleOrgChart({
  circles,
  selectedCircleId,
  layout = 'tree',
  showPolicies = true,
  showJurisdiction = true,
  maxAvatars = 5,
  expandedIds,
  ...rest
}: CircleOrgChartProps) {
  const tree = buildTree(circles);
  const expandedSet = new Set(expandedIds ?? []);
  const state = selectedCircleId ? 'circleSelected' : 'idle';
  const selectedCircle = selectedCircleId ? circles.find((c) => c.id === selectedCircleId) : undefined;

  return (
    <div
      role="tree"
      aria-label="Governance circles"
      data-surface-widget=""
      data-widget-name="circle-org-chart"
      data-part="root"
      data-state={state}
      data-layout={layout}
      {...rest}
    >
      {/* Tree hierarchy */}
      {tree.map((rootNode) =>
        renderCircleNode(rootNode, 0, selectedCircleId, expandedSet, showPolicies, showJurisdiction, maxAvatars),
      )}

      {/* Detail panel */}
      <div
        data-part="detail-panel"
        role="complementary"
        aria-label="Circle details"
        data-visible={state === 'circleSelected' ? 'true' : 'false'}
      >
        {selectedCircle && (
          <>
            <div data-part="detail-header">
              <span data-part="detail-title">{selectedCircle.name}</span>
            </div>

            <div data-part="detail-body">
              <div data-part="detail-field">
                <span data-part="detail-label">Purpose</span>
                <span data-part="detail-value">{selectedCircle.purpose}</span>
              </div>

              {selectedCircle.jurisdiction && (
                <div data-part="detail-field">
                  <span data-part="detail-label">Jurisdiction</span>
                  <span data-part="detail-value">{selectedCircle.jurisdiction}</span>
                </div>
              )}

              {selectedCircle.policies && selectedCircle.policies.length > 0 && (
                <div data-part="detail-field">
                  <span data-part="detail-label">Policies</span>
                  <span data-part="detail-value">{selectedCircle.policies.join(', ')}</span>
                </div>
              )}

              <div data-part="detail-field">
                <span data-part="detail-label">Members</span>
                <span data-part="detail-value">
                  {`${selectedCircle.members.length} member${selectedCircle.members.length !== 1 ? 's' : ''}`}
                </span>
              </div>

              <div data-part="detail-members">
                {selectedCircle.members.map((member, idx) => (
                  <div key={idx} data-part="detail-member">
                    <span data-part="detail-member-name">{member.name}</span>
                    <span data-part="detail-member-role">{member.role}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export { CircleOrgChart };
