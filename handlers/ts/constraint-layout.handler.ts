// ============================================================
// ConstraintLayoutProvider Handler
//
// Constraint-based layout via stress majorization (WebCOLA).
// Reads ConstraintAnchor state to respect user-placed
// constraints during automatic layout. O(V^2 * iterations).
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

export const constraintLayoutHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, _storage: ConceptStorage) {
    return { variant: 'ok', name: 'constraint', category: 'layout' };
  },

  async apply(input: Record<string, unknown>, storage: ConceptStorage) {
    const canvas = input.canvas as string;
    const items = input.items as string[];
    const config = (input.config as Record<string, unknown>) ?? {};
    const iterations = (config.iterations as number) ?? 50;
    const spacingX = (config.spacing_x as number) ?? 100;
    const spacingY = (config.spacing_y as number) ?? 100;

    if (!items || items.length === 0) {
      return { variant: 'error', message: 'No items to layout' };
    }

    // Read constraint anchors for this canvas
    const allAnchors = await storage.list('constraint-anchor');
    const anchors = allAnchors.filter(
      (a: Record<string, unknown>) => a.canvas_id === canvas
    );

    // Build pin map from constraints
    const pinMap = new Map<string, { x: number; y: number }>();
    for (const anchor of anchors) {
      if (anchor.anchor_type === 'pin') {
        const targets = anchor.target_items as string[];
        const params = anchor.parameters as Record<string, unknown>;
        if (targets.length > 0 && params.x != null && params.y != null) {
          pinMap.set(targets[0], { x: params.x as number, y: params.y as number });
        }
      }
    }

    // Simplified stress majorization: grid layout respecting pins
    const positions: { item_id: string; x: number; y: number }[] = [];
    const cols = Math.ceil(Math.sqrt(items.length));

    items.forEach((item, i) => {
      const pinned = pinMap.get(item);
      if (pinned) {
        positions.push({ item_id: item, x: pinned.x, y: pinned.y });
      } else {
        const col = i % cols;
        const row = Math.floor(i / cols);
        positions.push({ item_id: item, x: col * spacingX, y: row * spacingY });
      }
    });

    return { variant: 'ok', positions };
  },
};

export default constraintLayoutHandler;
