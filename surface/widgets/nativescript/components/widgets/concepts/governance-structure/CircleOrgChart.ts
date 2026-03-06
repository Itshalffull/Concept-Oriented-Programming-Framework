import {
  StackLayout,
  Label,
  Button,
  ScrollView,
  Color,
  View,
} from '@nativescript/core';

export type CircleOrgChartState = 'idle' | 'circleSelected';
export type CircleOrgChartEvent =
  | { type: 'SELECT_CIRCLE' }
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'DESELECT' };

export function circleOrgChartReducer(state: CircleOrgChartState, event: CircleOrgChartEvent): CircleOrgChartState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_CIRCLE') return 'circleSelected';
      if (event.type === 'EXPAND') return 'idle';
      if (event.type === 'COLLAPSE') return 'idle';
      return state;
    case 'circleSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_CIRCLE') return 'circleSelected';
      return state;
    default:
      return state;
  }
}

export interface CircleMember { name: string; role: string; }

export interface Circle {
  id: string;
  name: string;
  purpose: string;
  parentId?: string;
  members: CircleMember[];
  jurisdiction?: string;
  policies?: string[];
}

interface TreeNode { circle: Circle; children: TreeNode[]; }

function buildTree(circles: Circle[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  for (const c of circles) byId.set(c.id, { circle: c, children: [] });
  const roots: TreeNode[] = [];
  for (const c of circles) {
    const node = byId.get(c.id)!;
    if (c.parentId && byId.has(c.parentId)) byId.get(c.parentId)!.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export interface CircleOrgChartProps {
  circles: Circle[];
  selectedCircleId?: string;
  onSelectCircle?: (id: string | undefined) => void;
  showPolicies?: boolean;
  showJurisdiction?: boolean;
  maxAvatars?: number;
  expandedIds?: string[];
}

export function createCircleOrgChart(props: CircleOrgChartProps): { view: View; dispose: () => void } {
  let state: CircleOrgChartState = 'idle';
  let selectedId: string | undefined = props.selectedCircleId;
  const expandedSet = new Set<string>(props.expandedIds ?? []);
  const disposers: (() => void)[] = [];
  const maxAv = props.maxAvatars ?? 5;

  function send(event: CircleOrgChartEvent) { state = circleOrgChartReducer(state, event); }

  const root = new StackLayout();
  root.className = 'clef-circle-org-chart';
  root.automationText = 'Circle organization chart';

  function render() {
    root.removeChildren();
    const trees = buildTree(props.circles);
    const scroll = new ScrollView();
    const container = new StackLayout();

    function renderNode(node: TreeNode, depth: number) {
      const row = new StackLayout();
      row.padding = `6 8 6 ${depth * 24}`;
      if (selectedId === node.circle.id) row.backgroundColor = new Color('#dbeafe');

      const header = new StackLayout();
      header.orientation = 'horizontal';
      const hasKids = node.children.length > 0;
      const isExp = expandedSet.has(node.circle.id);

      if (hasKids) {
        const tog = new Label();
        tog.text = isExp ? '\u25BC' : '\u25B6';
        tog.width = 20; tog.fontSize = 12;
        const th = () => { if (isExp) { expandedSet.delete(node.circle.id); send({ type: 'COLLAPSE' }); } else { expandedSet.add(node.circle.id); send({ type: 'EXPAND' }); } render(); };
        tog.on('tap', th); disposers.push(() => tog.off('tap', th));
        header.addChild(tog);
      } else { const sp = new Label(); sp.text = '  '; sp.width = 20; header.addChild(sp); }

      const nm = new Label(); nm.text = node.circle.name; nm.fontWeight = 'bold'; nm.fontSize = 14; header.addChild(nm);
      const mc = new Label(); mc.text = ` (${node.circle.members.length})`; mc.fontSize = 12; mc.color = new Color('#6b7280'); header.addChild(mc);
      row.addChild(header);

      const pur = new Label(); pur.text = node.circle.purpose; pur.fontSize = 12; pur.color = new Color('#6b7280'); pur.textWrap = true; pur.marginLeft = 20; row.addChild(pur);

      if (props.showJurisdiction && node.circle.jurisdiction) {
        const jl = new Label(); jl.text = `Jurisdiction: ${node.circle.jurisdiction}`; jl.fontSize = 11; jl.color = new Color('#9ca3af'); jl.marginLeft = 20; row.addChild(jl);
      }

      const mr = new StackLayout(); mr.orientation = 'horizontal'; mr.marginLeft = 20; mr.marginTop = 2;
      for (const m of node.circle.members.slice(0, maxAv)) {
        const b = new Label(); b.text = m.name.charAt(0).toUpperCase(); b.fontSize = 11; b.width = 24; b.height = 24; b.borderRadius = 12; b.textAlignment = 'center'; b.backgroundColor = new Color('#e5e7eb'); b.marginRight = 2; mr.addChild(b);
      }
      if (node.circle.members.length > maxAv) { const mo = new Label(); mo.text = `+${node.circle.members.length - maxAv}`; mo.fontSize = 11; mo.color = new Color('#6b7280'); mr.addChild(mo); }
      row.addChild(mr);

      if (props.showPolicies && node.circle.policies?.length) {
        const pr = new StackLayout(); pr.orientation = 'horizontal'; pr.marginLeft = 20; pr.marginTop = 2;
        for (const p of node.circle.policies) { const pb = new Label(); pb.text = p; pb.fontSize = 10; pb.borderWidth = 1; pb.borderColor = new Color('#d1d5db'); pb.borderRadius = 4; pb.padding = '1 4'; pb.marginRight = 4; pr.addChild(pb); }
        row.addChild(pr);
      }

      row.automationText = `${node.circle.name} - ${node.circle.members.length} members`;
      const rh = () => { const next = selectedId === node.circle.id ? undefined : node.circle.id; selectedId = next; send({ type: next ? 'SELECT_CIRCLE' : 'DESELECT' }); props.onSelectCircle?.(next); render(); };
      row.on('tap', rh); disposers.push(() => row.off('tap', rh));
      container.addChild(row);
      if (hasKids && isExp) for (const ch of node.children) renderNode(ch, depth + 1);
    }

    for (const t of trees) renderNode(t, 0);
    scroll.content = container;
    root.addChild(scroll);

    if (selectedId) {
      const circle = props.circles.find(c => c.id === selectedId);
      if (circle) {
        const det = new StackLayout(); det.padding = '12'; det.borderTopWidth = 1; det.borderTopColor = new Color('#e5e7eb');
        const dn = new Label(); dn.text = circle.name; dn.fontWeight = 'bold'; dn.fontSize = 15; det.addChild(dn);
        const dp = new Label(); dp.text = circle.purpose; dp.fontSize = 13; dp.textWrap = true; dp.padding = '4 0'; det.addChild(dp);
        if (circle.jurisdiction) { const dj = new Label(); dj.text = `Jurisdiction: ${circle.jurisdiction}`; dj.fontSize = 12; dj.color = new Color('#6b7280'); det.addChild(dj); }
        const dm = new Label(); dm.text = 'Members:'; dm.fontWeight = 'bold'; dm.fontSize = 13; dm.marginTop = 8; det.addChild(dm);
        for (const m of circle.members) { const ml = new Label(); ml.text = `  ${m.name} - ${m.role}`; ml.fontSize = 12; det.addChild(ml); }
        root.addChild(det);
      }
    }
  }

  render();
  return { view: root, dispose() { disposers.forEach(d => d()); } };
}

export default createCircleOrgChart;
