const fs = require('fs');
const path = require('path');
const BASE = path.join(__dirname, '..', 'surface', 'widgets', 'winui', 'components', 'widgets', 'concepts');

function genFile(suite, cls, ns, desc, initState, states, events, transitions, extras) {
  extras = extras || {};
  const hasTimer = extras.hasTimer || false;
  const hasPointer = extras.hasPointer || false;
  const fields = extras.fields || '';
  const buildBody = extras.buildBody || '            // Visual tree populated by data-binding methods';
  const customMethods = extras.customMethods || '';

  const usings = [
    'using Microsoft.UI.Xaml;',
    'using Microsoft.UI.Xaml.Controls;',
    'using Microsoft.UI.Xaml.Automation;',
  ];
  if (hasPointer) usings.push('using Microsoft.UI.Xaml.Input;');
  if (hasTimer) usings.push('using Microsoft.UI.Dispatching;');

  const stateEnum = states.map(function(s) { return '        ' + s; }).join(',\n');
  const eventEnum = events.map(function(e) { return '        ' + e; }).join(',\n');

  var transitionCases = '';
  for (var fromState of Object.keys(transitions)) {
    var arms = '';
    var evtMap = transitions[fromState];
    for (var evt of Object.keys(evtMap)) {
      arms += '                WidgetEvent.' + evt + ' => WidgetState.' + evtMap[evt] + ',\n';
    }
    arms += '                _ => state';
    transitionCases += '            WidgetState.' + fromState + ' => @event switch\n            {\n' + arms + '\n            },\n';
  }

  var pointerHandlers = '';
  if (hasPointer) {
    pointerHandlers = '\n        private void OnPointerEntered(object sender, PointerRoutedEventArgs e)\n        {\n            Send(WidgetEvent.HOVER);\n        }\n\n        private void OnPointerExited(object sender, PointerRoutedEventArgs e)\n        {\n            Send(WidgetEvent.LEAVE);\n        }\n';
  }

  var timerField = hasTimer ? '        private DispatcherTimer? _timer;\n' : '';
  var timerDispose = hasTimer ? '            if (_timer != null) { _timer.Stop(); _timer = null; }\n' : '';
  var pointerDispose = hasPointer ? '            this.PointerEntered -= OnPointerEntered;\n            this.PointerExited -= OnPointerExited;\n' : '';
  var pointerHook = hasPointer ? '            this.PointerEntered += OnPointerEntered;\n            this.PointerExited += OnPointerExited;\n' : '';

  var safeDesc = desc.replace(/"/g, '\\"');
  var truncDesc = safeDesc.length > 80 ? safeDesc.substring(0, 80) : safeDesc;

  var code = usings.join('\n') + '\n\nnamespace Clef.Surface.Widgets.Concepts.' + ns + '\n{\n    /// <summary>\n    /// ' + desc + '\n    /// </summary>\n    public sealed partial class ' + cls + ' : UserControl, IDisposable\n    {\n        private enum WidgetState\n        {\n' + stateEnum + '\n        }\n\n        private enum WidgetEvent\n        {\n' + eventEnum + '\n        }\n\n        private WidgetState _state = WidgetState.' + initState + ';\n' + timerField + fields + '\n        // --- UI elements ---\n        private readonly StackPanel _root;\n\n        public ' + cls + '()\n        {\n            _root = new StackPanel { Spacing = 4 };\n            BuildUI();\n            this.Content = _root;\n\n            AutomationProperties.SetName(this, "' + truncDesc + '");\n' + pointerHook + '\n            this.KeyDown += OnKeyDown;\n        }\n\n        private void BuildUI()\n        {\n            _root.Children.Clear();\n' + buildBody + '\n        }\n\n        public void Send(WidgetEvent @event)\n        {\n            _state = Reduce(_state, @event);\n            UpdateVisualState();\n        }\n\n        private static WidgetState Reduce(WidgetState state, WidgetEvent @event) => state switch\n        {\n' + transitionCases + '            _ => state\n        };\n\n        private void UpdateVisualState()\n        {\n            // Update visual properties based on current _state\n        }\n' + pointerHandlers + '\n        private void OnKeyDown(object sender, Microsoft.UI.Xaml.Input.KeyRoutedEventArgs e)\n        {\n            if (e.Key == Windows.System.VirtualKey.Escape)\n            {\n                // Context-specific escape handling\n            }\n        }\n' + customMethods + '\n        public void Dispose()\n        {\n' + timerDispose + pointerDispose + '            this.KeyDown -= OnKeyDown;\n        }\n    }\n}\n';

  var dir = path.join(BASE, suite);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, cls + '.cs'), code, 'utf8');
  console.log('Wrote ' + suite + '/' + cls + '.cs');
}

// --- formal-verification (8 widgets) ---

genFile('formal-verification', 'CoverageSourceView', 'FormalVerification',
  'Source code overlay showing formal verification coverage annotations',
  'Idle', ['Idle', 'LineHovered'],
  ['HOVER_LINE', 'FILTER', 'JUMP_UNCOVERED', 'LEAVE', 'SELECT_LINE', 'NAVIGATE'],
  { Idle: { HOVER_LINE: 'LineHovered', FILTER: 'Idle', JUMP_UNCOVERED: 'Idle' },
    LineHovered: { LEAVE: 'Idle' } },
  { hasPointer: true,
    fields: '        private int _selectedLineIndex = -1;\n        private int _focusedLineIndex = 0;\n        private string _activeFilter = "all";\n        private readonly ScrollViewer _scrollViewer = new();\n        private readonly StackPanel _linesPanel = new();\n        private readonly StackPanel _filterBar = new();\n        private readonly TextBlock _summaryText = new();\n',
    buildBody: '            _summaryText.FontWeight = Microsoft.UI.Text.FontWeights.SemiBold;\n            _root.Children.Add(_summaryText);\n\n            _filterBar.Orientation = Orientation.Horizontal;\n            _filterBar.Spacing = 4;\n            foreach (var filter in new[] { "all", "covered", "uncovered", "partial" })\n            {\n                var f = filter;\n                var btn = new Button { Content = char.ToUpper(f[0]) + f.Substring(1), Tag = f };\n                btn.Click += (s, e) => { _activeFilter = ((Button)s!).Tag as string ?? "all"; Send(WidgetEvent.FILTER); };\n                _filterBar.Children.Add(btn);\n            }\n            _root.Children.Add(_filterBar);\n\n            _scrollViewer.Content = _linesPanel;\n            _root.Children.Add(_scrollViewer);\n            AutomationProperties.SetName(_scrollViewer, "Source lines");' });

genFile('formal-verification', 'DagViewer', 'FormalVerification',
  'Directed acyclic graph viewer for verification dependency visualization',
  'Idle', ['Idle', 'NodeSelected', 'Computing'],
  ['SELECT_NODE', 'ZOOM', 'PAN', 'LAYOUT', 'DESELECT', 'LAYOUT_COMPLETE'],
  { Idle: { SELECT_NODE: 'NodeSelected', ZOOM: 'Idle', PAN: 'Idle', LAYOUT: 'Computing' },
    NodeSelected: { DESELECT: 'Idle', SELECT_NODE: 'NodeSelected' },
    Computing: { LAYOUT_COMPLETE: 'Idle' } },
  { fields: '        private string? _selectedNodeId;\n        private readonly ScrollViewer _graphArea = new();\n        private readonly StackPanel _detailPanel = new();\n        private readonly TextBlock _detailTitle = new();\n        private readonly TextBlock _detailBody = new();\n',
    buildBody: '            _root.Children.Add(_graphArea);\n            AutomationProperties.SetName(_graphArea, "DAG graph area");\n\n            _detailPanel.Visibility = Visibility.Collapsed;\n            _detailPanel.Children.Add(_detailTitle);\n            _detailPanel.Children.Add(_detailBody);\n            _root.Children.Add(_detailPanel);' });

genFile('formal-verification', 'FormulaDisplay', 'FormalVerification',
  'Syntax-highlighted formula display with copy support',
  'Idle', ['Idle', 'Copied', 'Rendering'],
  ['COPY', 'RENDER_LATEX', 'TIMEOUT', 'RENDER_COMPLETE'],
  { Idle: { COPY: 'Copied', RENDER_LATEX: 'Rendering' },
    Copied: { TIMEOUT: 'Idle' },
    Rendering: { RENDER_COMPLETE: 'Idle' } },
  { hasTimer: true,
    fields: '        private bool _isExpanded = false;\n        private readonly TextBlock _formulaText = new() { IsTextSelectionEnabled = true, FontFamily = new Microsoft.UI.Xaml.Media.FontFamily("Cascadia Code,Consolas,monospace") };\n        private readonly Button _copyButton = new() { Content = "Copy" };\n        private readonly TextBlock _statusText = new();\n',
    buildBody: '            var header = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };\n            _copyButton.Click += (s, e) => { Send(WidgetEvent.COPY); CopyToClipboard(); };\n            header.Children.Add(_copyButton);\n            header.Children.Add(_statusText);\n            _root.Children.Add(header);\n            _root.Children.Add(_formulaText);',
    customMethods: '\n        private void CopyToClipboard()\n        {\n            var dp = new Windows.ApplicationModel.DataTransfer.DataPackage();\n            dp.SetText(_formulaText.Text);\n            Windows.ApplicationModel.DataTransfer.Clipboard.SetContent(dp);\n            _statusText.Text = "Copied!";\n            _timer = new DispatcherTimer { Interval = System.TimeSpan.FromSeconds(2) };\n            _timer.Tick += (s, e) => { _timer?.Stop(); Send(WidgetEvent.TIMEOUT); _statusText.Text = ""; };\n            _timer.Start();\n        }\n' });

genFile('formal-verification', 'ProofSessionTree', 'FormalVerification',
  'Recursive tree of proof goals with expand/collapse and status icons',
  'Idle', ['Idle', 'Selected', 'Ready', 'Fetching'],
  ['SELECT', 'EXPAND', 'COLLAPSE', 'DESELECT', 'LOAD_CHILDREN', 'LOAD_COMPLETE', 'LOAD_ERROR'],
  { Idle: { SELECT: 'Selected', EXPAND: 'Idle', COLLAPSE: 'Idle' },
    Selected: { DESELECT: 'Idle', SELECT: 'Selected' },
    Ready: { LOAD_CHILDREN: 'Fetching' },
    Fetching: { LOAD_COMPLETE: 'Ready', LOAD_ERROR: 'Ready' } },
  { fields: '        private string? _selectedGoalId;\n        private readonly TreeView _treeView = new();\n        private readonly StackPanel _detailPanel = new();\n',
    buildBody: '            AutomationProperties.SetName(_treeView, "Proof goals");\n            _root.Children.Add(_treeView);\n            _detailPanel.Visibility = Visibility.Collapsed;\n            _root.Children.Add(_detailPanel);' });

genFile('formal-verification', 'StatusGrid', 'FormalVerification',
  'Grid of verification status cells with filter bar and keyboard navigation',
  'Idle', ['Idle', 'CellHovered', 'CellSelected'],
  ['HOVER_CELL', 'CLICK_CELL', 'SORT', 'FILTER', 'LEAVE_CELL', 'DESELECT', 'FOCUS_NEXT_COL', 'FOCUS_PREV_COL', 'FOCUS_NEXT_ROW', 'FOCUS_PREV_ROW'],
  { Idle: { HOVER_CELL: 'CellHovered', CLICK_CELL: 'CellSelected', SORT: 'Idle', FILTER: 'Idle' },
    CellHovered: { LEAVE_CELL: 'Idle', CLICK_CELL: 'CellSelected' },
    CellSelected: { DESELECT: 'Idle', CLICK_CELL: 'CellSelected' } },
  { hasPointer: true,
    fields: '        private int _focusedRow = 0;\n        private int _focusedCol = 0;\n        private readonly StackPanel _filterBar = new() { Orientation = Orientation.Horizontal, Spacing = 4 };\n        private readonly Grid _grid = new();\n        private readonly StackPanel _detailPanel = new();\n',
    buildBody: '            _root.Children.Add(_filterBar);\n            AutomationProperties.SetName(_grid, "Verification status grid");\n            _root.Children.Add(_grid);\n            _detailPanel.Visibility = Visibility.Collapsed;\n            _root.Children.Add(_detailPanel);' });

genFile('formal-verification', 'TraceStepControls', 'FormalVerification',
  'Transport controls for stepping through verification traces',
  'Paused', ['Paused', 'Playing'],
  ['PLAY', 'STEP_FWD', 'STEP_BACK', 'JUMP_START', 'JUMP_END', 'PAUSE', 'REACH_END'],
  { Paused: { PLAY: 'Playing', STEP_FWD: 'Paused', STEP_BACK: 'Paused', JUMP_START: 'Paused', JUMP_END: 'Paused' },
    Playing: { PAUSE: 'Paused', REACH_END: 'Paused' } },
  { hasTimer: true,
    fields: '        private int _currentStep = 0;\n        private int _totalSteps = 0;\n        private int _speed = 1;\n        private readonly Button _playBtn = new() { Content = "\\u25B6" };\n        private readonly Button _pauseBtn = new() { Content = "\\u23F8" };\n        private readonly Button _stepFwdBtn = new() { Content = "\\u23ED" };\n        private readonly Button _stepBackBtn = new() { Content = "\\u23EE" };\n        private readonly Button _jumpStartBtn = new() { Content = "\\u23EE\\u23EE" };\n        private readonly Button _jumpEndBtn = new() { Content = "\\u23ED\\u23ED" };\n        private readonly TextBlock _stepLabel = new();\n        private readonly ProgressBar _progressBar = new() { Minimum = 0 };\n',
    buildBody: '            var transport = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };\n            _jumpStartBtn.Click += (s, e) => Send(WidgetEvent.JUMP_START);\n            _stepBackBtn.Click += (s, e) => Send(WidgetEvent.STEP_BACK);\n            _playBtn.Click += (s, e) => Send(WidgetEvent.PLAY);\n            _pauseBtn.Click += (s, e) => Send(WidgetEvent.PAUSE);\n            _stepFwdBtn.Click += (s, e) => Send(WidgetEvent.STEP_FWD);\n            _jumpEndBtn.Click += (s, e) => Send(WidgetEvent.JUMP_END);\n            transport.Children.Add(_jumpStartBtn);\n            transport.Children.Add(_stepBackBtn);\n            transport.Children.Add(_playBtn);\n            transport.Children.Add(_pauseBtn);\n            transport.Children.Add(_stepFwdBtn);\n            transport.Children.Add(_jumpEndBtn);\n            transport.Children.Add(_stepLabel);\n            _root.Children.Add(transport);\n            _root.Children.Add(_progressBar);\n            AutomationProperties.SetName(_progressBar, "Trace step progress");' });

genFile('formal-verification', 'TraceTimelineViewer', 'FormalVerification',
  'Timeline viewer showing variable lanes across verification trace steps',
  'Idle', ['Idle', 'Playing', 'CellSelected'],
  ['PLAY', 'STEP_FORWARD', 'STEP_BACKWARD', 'SELECT_CELL', 'ZOOM', 'PAUSE', 'STEP_END', 'DESELECT'],
  { Idle: { PLAY: 'Playing', STEP_FORWARD: 'Idle', STEP_BACKWARD: 'Idle', SELECT_CELL: 'CellSelected', ZOOM: 'Idle' },
    Playing: { PAUSE: 'Idle', STEP_END: 'Idle' },
    CellSelected: { DESELECT: 'Idle', SELECT_CELL: 'CellSelected' } },
  { hasTimer: true,
    fields: '        private int _currentStep = 0;\n        private readonly ScrollViewer _timelineArea = new();\n        private readonly StackPanel _lanesPanel = new();\n        private readonly StackPanel _detailPanel = new();\n',
    buildBody: '            _timelineArea.Content = _lanesPanel;\n            AutomationProperties.SetName(_timelineArea, "Trace timeline");\n            _root.Children.Add(_timelineArea);\n            _detailPanel.Visibility = Visibility.Collapsed;\n            _root.Children.Add(_detailPanel);' });

genFile('formal-verification', 'VerificationStatusBadge', 'FormalVerification',
  'Compact status badge showing verification result with icon and tooltip',
  'Idle', ['Idle', 'Hovered', 'Animating'],
  ['HOVER', 'STATUS_CHANGE', 'LEAVE', 'ANIMATION_END'],
  { Idle: { HOVER: 'Hovered', STATUS_CHANGE: 'Animating' },
    Hovered: { LEAVE: 'Idle' },
    Animating: { ANIMATION_END: 'Idle' } },
  { hasPointer: true, hasTimer: true,
    fields: '        private string _status = "unknown";\n        private readonly TextBlock _iconText = new() { FontSize = 16 };\n        private readonly TextBlock _labelText = new();\n        private readonly Border _badge = new() { Padding = new Thickness(6, 2, 6, 2), CornerRadius = new CornerRadius(4) };\n',
    buildBody: '            var inner = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };\n            inner.Children.Add(_iconText);\n            inner.Children.Add(_labelText);\n            _badge.Child = inner;\n            _root.Children.Add(_badge);\n            ToolTipService.SetToolTip(_badge, "Verification status");' });

console.log("Batch 1 complete: 8 formal-verification widgets");
