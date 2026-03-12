// ============================================================
// Clef Surface GTK Widget — GraphAnalysisPanel
//
// Analysis panel for running graph algorithms on a canvas.
// Provides category tabs (centrality, community, path, etc.),
// algorithm selection, run controls with progress indication,
// a scores table, overlay toggles, and report generation.
//
// Adapts the graph-analysis-panel.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export type AnalysisCategory =
  | 'centrality'
  | 'community'
  | 'path'
  | 'clustering'
  | 'similarity'
  | 'flow'
  | 'spectral';

export type WorkflowState = 'idle' | 'ready' | 'running' | 'complete' | 'error';

export interface ScoreRow {
  rank: number;
  node: string;
  score: number;
}

export interface OverlayEntry {
  id: string;
  label: string;
  enabled: boolean;
}

// --------------- Props ---------------

export interface GraphAnalysisPanelProps {
  canvasId?: string;
  selectedCategory?: AnalysisCategory;
  selectedAlgorithm?: string;
  workflowState?: WorkflowState;
  overlaysEnabled?: boolean;
  reportFormat?: string;
  algorithms?: Record<AnalysisCategory, string[]>;
  scores?: ScoreRow[];
  overlays?: OverlayEntry[];
  onRun?: (algorithm: string) => void;
  onOverlayToggle?: (overlayId: string, enabled: boolean) => void;
  onGenerateReport?: (format: string) => void;
  onExport?: () => void;
  onCompare?: () => void;
}

// --------------- Constants ---------------

const CATEGORY_LABELS: Record<AnalysisCategory, string> = {
  centrality: 'Centrality',
  community: 'Community',
  path: 'Path',
  clustering: 'Clustering',
  similarity: 'Similarity',
  flow: 'Flow',
  spectral: 'Spectral',
};

const DEFAULT_ALGORITHMS: Record<AnalysisCategory, string[]> = {
  centrality: ['Degree', 'Betweenness', 'Closeness', 'Eigenvector', 'PageRank'],
  community: ['Louvain', 'Label Propagation', 'Girvan-Newman'],
  path: ['Shortest Path', 'All Pairs', 'Diameter'],
  clustering: ['Coefficient', 'Triangle Count', 'K-Core'],
  similarity: ['Jaccard', 'Cosine', 'Overlap'],
  flow: ['Max Flow', 'Min Cut', 'Network Flow'],
  spectral: ['Laplacian', 'Fiedler Vector', 'Spectral Clustering'],
};

// --------------- Helpers ---------------

function buildAlgorithmSelector(
  algorithms: string[],
  selected: string | undefined,
  onChanged: (algorithm: string) => void,
): Gtk.ComboBoxText {
  const combo = new Gtk.ComboBoxText();
  algorithms.forEach((algo) => combo.append_text(algo));

  const idx = selected ? algorithms.indexOf(selected) : 0;
  combo.set_active(idx >= 0 ? idx : 0);

  combo.connect('changed', () => {
    const active = combo.get_active_text();
    if (active) onChanged(active);
  });

  return combo;
}

function buildScoresTable(scores: ScoreRow[]): Gtk.Widget {
  const listBox = new Gtk.ListBox({ selectionMode: Gtk.SelectionMode.NONE });
  listBox.get_style_context().add_class('boxed-list');

  // Header row
  const headerRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
  headerRow.set_margin_top(4);
  headerRow.set_margin_bottom(4);
  headerRow.set_margin_start(8);
  headerRow.set_margin_end(8);

  const rankHeader = new Gtk.Label({ label: 'Rank', xalign: 0, widthChars: 6 });
  rankHeader.get_style_context().add_class('heading');
  headerRow.append(rankHeader);

  const nodeHeader = new Gtk.Label({ label: 'Node', xalign: 0, hexpand: true });
  nodeHeader.get_style_context().add_class('heading');
  headerRow.append(nodeHeader);

  const scoreHeader = new Gtk.Label({ label: 'Score', xalign: 1, widthChars: 10 });
  scoreHeader.get_style_context().add_class('heading');
  headerRow.append(scoreHeader);

  listBox.append(headerRow);

  // Data rows
  scores.forEach((row) => {
    const dataRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
    dataRow.set_margin_top(2);
    dataRow.set_margin_bottom(2);
    dataRow.set_margin_start(8);
    dataRow.set_margin_end(8);

    const rankLabel = new Gtk.Label({ label: String(row.rank), xalign: 0, widthChars: 6 });
    rankLabel.get_style_context().add_class('dim-label');
    dataRow.append(rankLabel);

    const nodeLabel = new Gtk.Label({ label: row.node, xalign: 0, hexpand: true });
    dataRow.append(nodeLabel);

    const scoreLabel = new Gtk.Label({ label: row.score.toFixed(4), xalign: 1, widthChars: 10 });
    scoreLabel.get_style_context().add_class('numeric');
    dataRow.append(scoreLabel);

    listBox.append(dataRow);
  });

  return listBox;
}

function buildOverlayControls(
  overlays: OverlayEntry[],
  masterEnabled: boolean,
  onToggle?: (overlayId: string, enabled: boolean) => void,
): Gtk.Widget {
  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });

  // Master toggle
  const masterRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
  masterRow.set_margin_start(8);
  masterRow.set_margin_end(8);

  const masterLabel = new Gtk.Label({ label: 'Overlays', xalign: 0, hexpand: true });
  masterLabel.get_style_context().add_class('heading');
  masterRow.append(masterLabel);

  const masterSwitch = new Gtk.Switch({ active: masterEnabled, valign: Gtk.Align.CENTER });
  masterRow.append(masterSwitch);
  box.append(masterRow);

  // Per-overlay toggles
  const overlayList = new Gtk.ListBox({ selectionMode: Gtk.SelectionMode.NONE });
  overlayList.get_style_context().add_class('boxed-list');

  overlays.forEach((overlay) => {
    const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
    row.set_margin_top(4);
    row.set_margin_bottom(4);
    row.set_margin_start(8);
    row.set_margin_end(8);

    const label = new Gtk.Label({ label: overlay.label, xalign: 0, hexpand: true });
    row.append(label);

    const toggle = new Gtk.Switch({ active: overlay.enabled, valign: Gtk.Align.CENTER });
    toggle.connect('notify::active', () => {
      onToggle?.(overlay.id, toggle.get_active());
    });
    row.append(toggle);

    overlayList.append(row);
  });

  // Master switch controls sensitivity of overlay list
  masterSwitch.connect('notify::active', () => {
    overlayList.set_sensitive(masterSwitch.get_active());
    onToggle?.('__master', masterSwitch.get_active());
  });
  overlayList.set_sensitive(masterEnabled);

  box.append(overlayList);

  return box;
}

// --------------- Component ---------------

export function createGraphAnalysisPanel(props: GraphAnalysisPanelProps = {}): Gtk.Widget {
  const {
    selectedCategory = 'centrality',
    selectedAlgorithm,
    workflowState = 'idle',
    overlaysEnabled = false,
    reportFormat = 'json',
    algorithms = DEFAULT_ALGORITHMS,
    scores = [],
    overlays = [],
    onRun,
    onOverlayToggle,
    onGenerateReport,
    onExport,
    onCompare,
  } = props;

  const root = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 0, widthRequest: 340 });
  root.get_style_context().add_class('graph-analysis-panel');

  // Header
  const header = new Gtk.Label({ label: 'Graph Analysis', xalign: 0 });
  header.get_style_context().add_class('heading');
  header.set_margin_top(8);
  header.set_margin_start(12);
  header.set_margin_bottom(8);
  root.append(header);

  // Category tabs via GtkStack + GtkStackSwitcher
  const stack = new Gtk.Stack({
    transitionType: Gtk.StackTransitionType.CROSSFADE,
    transitionDuration: 150,
  });

  const switcher = new Gtk.StackSwitcher({ stack });
  switcher.set_margin_start(8);
  switcher.set_margin_end(8);
  switcher.set_margin_bottom(4);
  root.append(switcher);

  const topSeparator = new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL });
  root.append(topSeparator);

  // Track mutable state
  let currentAlgorithm = selectedAlgorithm ?? '';
  let currentFormat = reportFormat;

  // Build a page for each category
  const categories = Object.keys(CATEGORY_LABELS) as AnalysisCategory[];

  categories.forEach((category) => {
    const page = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 12, vexpand: true });
    page.set_margin_top(8);
    page.set_margin_start(12);
    page.set_margin_end(12);
    page.set_margin_bottom(8);

    // Algorithm selector
    const algoLabel = new Gtk.Label({ label: 'Algorithm', xalign: 0 });
    algoLabel.get_style_context().add_class('dim-label');
    page.append(algoLabel);

    const categoryAlgorithms = algorithms[category] ?? [];
    const combo = buildAlgorithmSelector(
      categoryAlgorithms,
      category === selectedCategory ? selectedAlgorithm : undefined,
      (algo) => { currentAlgorithm = algo; },
    );
    page.append(combo);

    // Run button
    const runBtn = new Gtk.Button({ label: 'Run Analysis' });
    runBtn.get_style_context().add_class('suggested-action');
    runBtn.set_sensitive(workflowState !== 'running' && categoryAlgorithms.length > 0);

    runBtn.connect('clicked', () => {
      const active = combo.get_active_text();
      if (active) onRun?.(active);
    });
    page.append(runBtn);

    // Progress indicator (visible only when running)
    const spinner = new Gtk.Spinner();
    spinner.set_visible(workflowState === 'running' && category === selectedCategory);
    if (workflowState === 'running' && category === selectedCategory) {
      spinner.start();
    }
    page.append(spinner);

    // Scores table (visible when complete)
    if (category === selectedCategory && scores.length > 0) {
      const scoresLabel = new Gtk.Label({ label: 'Results', xalign: 0 });
      scoresLabel.get_style_context().add_class('dim-label');
      page.append(scoresLabel);

      const scrolled = new Gtk.ScrolledWindow({
        hscrollbarPolicy: Gtk.PolicyType.NEVER,
        vscrollbarPolicy: Gtk.PolicyType.AUTOMATIC,
        vexpand: true,
      });
      scrolled.set_child(buildScoresTable(scores));
      page.append(scrolled);
    }

    stack.add_titled(page, category, CATEGORY_LABELS[category]);
  });

  // Set active category
  stack.set_visible_child_name(selectedCategory);

  root.append(stack);

  // Bottom separator
  const bottomSeparator = new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL });
  root.append(bottomSeparator);

  // Overlay controls
  const overlaySection = buildOverlayControls(overlays, overlaysEnabled, onOverlayToggle);
  overlaySection.set_margin_top(8);
  overlaySection.set_margin_bottom(8);
  root.append(overlaySection);

  // Report separator
  const reportSeparator = new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL });
  root.append(reportSeparator);

  // Report section
  const reportBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });
  reportBox.set_margin_top(8);
  reportBox.set_margin_start(12);
  reportBox.set_margin_end(12);
  reportBox.set_margin_bottom(8);

  const reportLabel = new Gtk.Label({ label: 'Report', xalign: 0 });
  reportLabel.get_style_context().add_class('dim-label');
  reportBox.append(reportLabel);

  // Format selector
  const formatCombo = new Gtk.ComboBoxText();
  const formats = ['json', 'csv', 'html', 'pdf'];
  formats.forEach((fmt) => formatCombo.append_text(fmt));
  const fmtIdx = formats.indexOf(reportFormat);
  formatCombo.set_active(fmtIdx >= 0 ? fmtIdx : 0);
  formatCombo.connect('changed', () => {
    const active = formatCombo.get_active_text();
    if (active) currentFormat = active;
  });
  reportBox.append(formatCombo);

  // Action buttons row
  const actionRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8, homogeneous: true });

  const generateBtn = new Gtk.Button({ label: 'Generate Report' });
  generateBtn.get_style_context().add_class('suggested-action');
  generateBtn.connect('clicked', () => {
    onGenerateReport?.(currentFormat);
  });
  actionRow.append(generateBtn);

  const compareBtn = new Gtk.Button({ label: 'Compare' });
  compareBtn.connect('clicked', () => {
    onCompare?.();
  });
  actionRow.append(compareBtn);

  reportBox.append(actionRow);

  // Export button
  const exportBtn = new Gtk.Button({ label: 'Export Data' });
  exportBtn.connect('clicked', () => {
    onExport?.();
  });
  reportBox.append(exportBtn);

  root.append(reportBox);

  return root;
}
