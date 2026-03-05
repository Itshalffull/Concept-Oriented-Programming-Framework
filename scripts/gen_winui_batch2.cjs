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

// --- governance-decision (3 widgets) ---

genFile('governance-decision', 'DeliberationThread', 'GovernanceDecision',
  'Threaded discussion view for governance deliberations with nested replies',
  'Viewing', ['Viewing', 'Composing', 'EntrySelected'],
  ['REPLY_TO', 'SELECT_ENTRY', 'SEND', 'CANCEL', 'DESELECT'],
  { Viewing: { REPLY_TO: 'Composing', SELECT_ENTRY: 'EntrySelected' },
    Composing: { SEND: 'Viewing', CANCEL: 'Viewing' },
    EntrySelected: { DESELECT: 'Viewing', REPLY_TO: 'Composing' } },
  { fields: '        private string? _replyTargetId;\n        private string? _selectedEntryId;\n        private string _sortOrder = "chronological";\n        private readonly ScrollViewer _threadScroll = new();\n        private readonly StackPanel _threadPanel = new();\n        private readonly StackPanel _composeBox = new();\n        private readonly TextBox _composeInput = new() { PlaceholderText = "Write a reply...", AcceptsReturn = true };\n        private readonly Button _sendBtn = new() { Content = "Send" };\n        private readonly Button _cancelBtn = new() { Content = "Cancel" };\n        private readonly StackPanel _sortBar = new() { Orientation = Orientation.Horizontal, Spacing = 4 };\n',
    buildBody: '            // Sort controls\n            foreach (var sort in new[] { "chronological", "sentiment", "newest" })\n            {\n                var s = sort;\n                var btn = new Button { Content = char.ToUpper(s[0]) + s.Substring(1), Tag = s };\n                btn.Click += (sender, e) => { _sortOrder = ((Button)sender!).Tag as string ?? "chronological"; };\n                _sortBar.Children.Add(btn);\n            }\n            _root.Children.Add(_sortBar);\n\n            // Thread area\n            _threadScroll.Content = _threadPanel;\n            _root.Children.Add(_threadScroll);\n            AutomationProperties.SetName(_threadScroll, "Deliberation thread");\n\n            // Compose box\n            _composeBox.Visibility = Visibility.Collapsed;\n            _sendBtn.Click += (s, e) => Send(WidgetEvent.SEND);\n            _cancelBtn.Click += (s, e) => Send(WidgetEvent.CANCEL);\n            _composeBox.Children.Add(_composeInput);\n            var btnRow = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };\n            btnRow.Children.Add(_sendBtn);\n            btnRow.Children.Add(_cancelBtn);\n            _composeBox.Children.Add(btnRow);\n            _root.Children.Add(_composeBox);' });

genFile('governance-decision', 'ProposalCard', 'GovernanceDecision',
  'Card displaying a governance proposal with status, description, and actions',
  'Idle', ['Idle', 'Hovered', 'Focused', 'Navigating'],
  ['HOVER', 'UNHOVER', 'FOCUS', 'BLUR', 'CLICK', 'ENTER', 'NAVIGATE_COMPLETE'],
  { Idle: { HOVER: 'Hovered', FOCUS: 'Focused', CLICK: 'Navigating' },
    Hovered: { UNHOVER: 'Idle' },
    Focused: { BLUR: 'Idle', CLICK: 'Navigating', ENTER: 'Navigating' },
    Navigating: { NAVIGATE_COMPLETE: 'Idle' } },
  { hasPointer: true,
    fields: '        private readonly Border _card = new() { Padding = new Thickness(12), CornerRadius = new CornerRadius(8) };\n        private readonly TextBlock _titleText = new() { FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };\n        private readonly TextBlock _statusBadge = new();\n        private readonly TextBlock _descriptionText = new() { TextWrapping = TextWrapping.Wrap, MaxLines = 3 };\n        private readonly TextBlock _timeRemaining = new();\n        private readonly Button _actionBtn = new() { Content = "View" };\n',
    buildBody: '            var inner = new StackPanel { Spacing = 6 };\n            var header = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };\n            header.Children.Add(_titleText);\n            header.Children.Add(_statusBadge);\n            inner.Children.Add(header);\n            inner.Children.Add(_descriptionText);\n            var footer = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };\n            footer.Children.Add(_timeRemaining);\n            _actionBtn.Click += (s, e) => Send(WidgetEvent.CLICK);\n            footer.Children.Add(_actionBtn);\n            inner.Children.Add(footer);\n            _card.Child = inner;\n            _root.Children.Add(_card);' });

genFile('governance-decision', 'VoteResultBar', 'GovernanceDecision',
  'Proportional bar chart showing vote result segments with quorum marker',
  'Idle', ['Idle', 'Animating', 'SegmentHovered'],
  ['HOVER_SEGMENT', 'ANIMATE_IN', 'ANIMATION_END', 'UNHOVER', 'FOCUS_NEXT_SEGMENT', 'FOCUS_PREV_SEGMENT'],
  { Idle: { HOVER_SEGMENT: 'SegmentHovered', ANIMATE_IN: 'Animating' },
    Animating: { ANIMATION_END: 'Idle' },
    SegmentHovered: { UNHOVER: 'Idle', HOVER_SEGMENT: 'SegmentHovered' } },
  { hasPointer: true, hasTimer: true,
    fields: '        private int _hoveredSegmentIndex = -1;\n        private int _focusedSegmentIndex = 0;\n        private readonly StackPanel _barContainer = new() { Orientation = Orientation.Horizontal };\n        private readonly TextBlock _tooltipText = new() { Visibility = Visibility.Collapsed };\n        private readonly TextBlock _quorumLabel = new();\n',
    buildBody: '            _root.Children.Add(_barContainer);\n            AutomationProperties.SetName(_barContainer, "Vote result bar");\n            _root.Children.Add(_tooltipText);\n            _root.Children.Add(_quorumLabel);' });

// --- governance-execution (3 widgets) ---

genFile('governance-execution', 'ExecutionPipeline', 'GovernanceExecution',
  'Pipeline visualization showing sequential execution stages with status',
  'Idle', ['Idle', 'StageSelected', 'Failed'],
  ['ADVANCE', 'SELECT_STAGE', 'FAIL', 'DESELECT', 'RETRY', 'RESET'],
  { Idle: { ADVANCE: 'Idle', SELECT_STAGE: 'StageSelected', FAIL: 'Failed' },
    StageSelected: { DESELECT: 'Idle' },
    Failed: { RETRY: 'Idle', RESET: 'Idle' } },
  { fields: '        private string? _selectedStageId;\n        private readonly StackPanel _stagesPanel = new() { Orientation = Orientation.Horizontal, Spacing = 8 };\n        private readonly StackPanel _detailPanel = new();\n        private readonly InfoBar _failureBanner = new() { IsOpen = false, Severity = InfoBarSeverity.Error, Title = "Stage failed" };\n        private readonly Button _retryBtn = new() { Content = "Retry" };\n        private readonly Button _resetBtn = new() { Content = "Reset" };\n',
    buildBody: '            _root.Children.Add(_failureBanner);\n            _root.Children.Add(_stagesPanel);\n            AutomationProperties.SetName(_stagesPanel, "Pipeline stages");\n\n            _detailPanel.Visibility = Visibility.Collapsed;\n            _root.Children.Add(_detailPanel);\n\n            var actionBar = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };\n            _retryBtn.Click += (s, e) => Send(WidgetEvent.RETRY);\n            _resetBtn.Click += (s, e) => Send(WidgetEvent.RESET);\n            actionBar.Children.Add(_retryBtn);\n            actionBar.Children.Add(_resetBtn);\n            _root.Children.Add(actionBar);' });

genFile('governance-execution', 'GuardStatusPanel', 'GovernanceExecution',
  'Panel listing guard conditions with pass/fail status indicators',
  'Idle', ['Idle', 'GuardSelected'],
  ['SELECT_GUARD', 'GUARD_TRIP', 'DESELECT'],
  { Idle: { SELECT_GUARD: 'GuardSelected', GUARD_TRIP: 'Idle' },
    GuardSelected: { DESELECT: 'Idle' } },
  { fields: '        private string? _selectedGuardId;\n        private readonly StackPanel _guardList = new();\n        private readonly InfoBar _blockingBanner = new() { IsOpen = false, Severity = InfoBarSeverity.Warning, Title = "Guards blocking execution" };\n        private readonly StackPanel _detailPanel = new();\n',
    buildBody: '            _root.Children.Add(_blockingBanner);\n            _root.Children.Add(_guardList);\n            AutomationProperties.SetName(_guardList, "Guard conditions");\n            _detailPanel.Visibility = Visibility.Collapsed;\n            _root.Children.Add(_detailPanel);' });

genFile('governance-execution', 'TimelockCountdown', 'GovernanceExecution',
  'Countdown timer for timelock-gated governance actions with execute/challenge',
  'Running', ['Running', 'Warning', 'Critical', 'Expired', 'Executing', 'Completed', 'Paused'],
  ['TICK', 'WARNING_THRESHOLD', 'EXPIRE', 'PAUSE', 'CRITICAL_THRESHOLD', 'EXECUTE', 'RESET', 'EXECUTE_COMPLETE', 'EXECUTE_ERROR', 'RESUME', 'CHALLENGE'],
  { Running: { TICK: 'Running', WARNING_THRESHOLD: 'Warning', EXPIRE: 'Expired', PAUSE: 'Paused' },
    Warning: { TICK: 'Warning', CRITICAL_THRESHOLD: 'Critical', EXPIRE: 'Expired' },
    Critical: { TICK: 'Critical', EXPIRE: 'Expired' },
    Expired: { EXECUTE: 'Executing', RESET: 'Running' },
    Executing: { EXECUTE_COMPLETE: 'Completed', EXECUTE_ERROR: 'Expired' },
    Completed: {},
    Paused: { RESUME: 'Running' } },
  { hasTimer: true,
    fields: '        private long _remainingMs = 0;\n        private readonly TextBlock _countdownText = new() { FontSize = 24, FontWeight = Microsoft.UI.Text.FontWeights.Bold };\n        private readonly ProgressBar _progressBar = new() { Minimum = 0, Maximum = 100 };\n        private readonly TextBlock _phaseLabel = new();\n        private readonly Button _executeBtn = new() { Content = "Execute" };\n        private readonly Button _challengeBtn = new() { Content = "Challenge" };\n        private readonly Button _pauseBtn = new() { Content = "Pause" };\n        private readonly Button _resumeBtn = new() { Content = "Resume" };\n',
    buildBody: '            _root.Children.Add(_countdownText);\n            _root.Children.Add(_progressBar);\n            AutomationProperties.SetName(_progressBar, "Timelock countdown progress");\n            _root.Children.Add(_phaseLabel);\n\n            var actionBar = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };\n            _executeBtn.Click += (s, e) => Send(WidgetEvent.EXECUTE);\n            _challengeBtn.Click += (s, e) => Send(WidgetEvent.CHALLENGE);\n            _pauseBtn.Click += (s, e) => Send(WidgetEvent.PAUSE);\n            _resumeBtn.Click += (s, e) => Send(WidgetEvent.RESUME);\n            actionBar.Children.Add(_executeBtn);\n            actionBar.Children.Add(_challengeBtn);\n            actionBar.Children.Add(_pauseBtn);\n            actionBar.Children.Add(_resumeBtn);\n            _root.Children.Add(actionBar);',
    customMethods: '\n        public void StartCountdown(long totalMs)\n        {\n            _remainingMs = totalMs;\n            _timer = new DispatcherTimer { Interval = System.TimeSpan.FromSeconds(1) };\n            _timer.Tick += (s, e) =>\n            {\n                _remainingMs -= 1000;\n                if (_remainingMs <= 0) { _timer?.Stop(); Send(WidgetEvent.EXPIRE); }\n                else { Send(WidgetEvent.TICK); }\n                UpdateCountdownDisplay();\n            };\n            _timer.Start();\n        }\n\n        private void UpdateCountdownDisplay()\n        {\n            var ts = System.TimeSpan.FromMilliseconds(System.Math.Max(0, _remainingMs));\n            _countdownText.Text = ts.ToString(@"hh\\:mm\\:ss");\n        }\n' });

// --- governance-structure (3 widgets) ---

genFile('governance-structure', 'CircleOrgChart', 'GovernanceStructure',
  'Organizational chart showing nested circles with members and roles',
  'Idle', ['Idle', 'CircleSelected'],
  ['SELECT_CIRCLE', 'DESELECT', 'EXPAND', 'COLLAPSE'],
  { Idle: { SELECT_CIRCLE: 'CircleSelected' },
    CircleSelected: { DESELECT: 'Idle', SELECT_CIRCLE: 'CircleSelected' } },
  { fields: '        private string? _selectedCircleId;\n        private readonly TreeView _orgTree = new();\n        private readonly StackPanel _detailPanel = new();\n        private readonly TextBlock _circleName = new() { FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };\n        private readonly TextBlock _circlePurpose = new() { TextWrapping = TextWrapping.Wrap };\n        private readonly StackPanel _membersList = new();\n',
    buildBody: '            AutomationProperties.SetName(_orgTree, "Circle organization chart");\n            _root.Children.Add(_orgTree);\n\n            _detailPanel.Visibility = Visibility.Collapsed;\n            _detailPanel.Children.Add(_circleName);\n            _detailPanel.Children.Add(_circlePurpose);\n            _detailPanel.Children.Add(_membersList);\n            _root.Children.Add(_detailPanel);' });

genFile('governance-structure', 'DelegationGraph', 'GovernanceStructure',
  'Graph visualization of voting power delegation chains with search',
  'Browsing', ['Browsing', 'Searching', 'Selected', 'Delegating', 'Undelegating'],
  ['SEARCH', 'SELECT_DELEGATE', 'SWITCH_VIEW', 'CLEAR_SEARCH', 'DESELECT', 'DELEGATE', 'UNDELEGATE', 'DELEGATE_COMPLETE', 'DELEGATE_ERROR', 'UNDELEGATE_COMPLETE', 'UNDELEGATE_ERROR'],
  { Browsing: { SEARCH: 'Searching', SELECT_DELEGATE: 'Selected', SWITCH_VIEW: 'Browsing' },
    Searching: { CLEAR_SEARCH: 'Browsing', SELECT_DELEGATE: 'Selected' },
    Selected: { DESELECT: 'Browsing', DELEGATE: 'Delegating', UNDELEGATE: 'Undelegating' },
    Delegating: { DELEGATE_COMPLETE: 'Browsing', DELEGATE_ERROR: 'Selected' },
    Undelegating: { UNDELEGATE_COMPLETE: 'Browsing', UNDELEGATE_ERROR: 'Selected' } },
  { fields: '        private string? _selectedDelegateId;\n        private string _searchQuery = "";\n        private readonly TextBox _searchBox = new() { PlaceholderText = "Search delegates..." };\n        private readonly ScrollViewer _graphArea = new();\n        private readonly StackPanel _detailPanel = new();\n        private readonly Button _delegateBtn = new() { Content = "Delegate" };\n        private readonly Button _undelegateBtn = new() { Content = "Undelegate" };\n        private readonly ProgressRing _loadingRing = new() { IsActive = false };\n',
    buildBody: '            _searchBox.TextChanged += (s, e) => { _searchQuery = _searchBox.Text; Send(_searchQuery.Length > 0 ? WidgetEvent.SEARCH : WidgetEvent.CLEAR_SEARCH); };\n            _root.Children.Add(_searchBox);\n\n            _root.Children.Add(_graphArea);\n            AutomationProperties.SetName(_graphArea, "Delegation graph");\n\n            _detailPanel.Visibility = Visibility.Collapsed;\n            _delegateBtn.Click += (s, e) => Send(WidgetEvent.DELEGATE);\n            _undelegateBtn.Click += (s, e) => Send(WidgetEvent.UNDELEGATE);\n            var actionBar = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };\n            actionBar.Children.Add(_delegateBtn);\n            actionBar.Children.Add(_undelegateBtn);\n            actionBar.Children.Add(_loadingRing);\n            _detailPanel.Children.Add(actionBar);\n            _root.Children.Add(_detailPanel);' });

genFile('governance-structure', 'WeightBreakdown', 'GovernanceStructure',
  'Stacked bar showing voting weight breakdown by source type',
  'Idle', ['Idle', 'SegmentHovered'],
  ['HOVER_SEGMENT', 'LEAVE'],
  { Idle: { HOVER_SEGMENT: 'SegmentHovered' },
    SegmentHovered: { LEAVE: 'Idle' } },
  { hasPointer: true,
    fields: '        private int _hoveredIndex = -1;\n        private readonly StackPanel _barContainer = new() { Orientation = Orientation.Horizontal };\n        private readonly TextBlock _totalLabel = new() { FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };\n        private readonly TextBlock _tooltipText = new() { Visibility = Visibility.Collapsed };\n        private readonly StackPanel _legendPanel = new();\n',
    buildBody: '            _root.Children.Add(_totalLabel);\n            _root.Children.Add(_barContainer);\n            AutomationProperties.SetName(_barContainer, "Weight breakdown bar");\n            _root.Children.Add(_tooltipText);\n            _root.Children.Add(_legendPanel);' });

console.log("Batch 2 complete: 9 governance widgets");
