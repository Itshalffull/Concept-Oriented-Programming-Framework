using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts.GovernanceExecution
{
    /// <summary>
    /// Pipeline visualization showing sequential execution stages with status
    /// </summary>
    public sealed partial class ExecutionPipeline : UserControl, IDisposable
    {
        private enum WidgetState
        {
        Idle,
        StageSelected,
        Failed
        }

        private enum WidgetEvent
        {
        ADVANCE,
        SELECT_STAGE,
        FAIL,
        DESELECT,
        RETRY,
        RESET
        }

        private WidgetState _state = WidgetState.Idle;
        private string? _selectedStageId;
        private readonly StackPanel _stagesPanel = new() { Orientation = Orientation.Horizontal, Spacing = 8 };
        private readonly StackPanel _detailPanel = new();
        private readonly InfoBar _failureBanner = new() { IsOpen = false, Severity = InfoBarSeverity.Error, Title = "Stage failed" };
        private readonly Button _retryBtn = new() { Content = "Retry" };
        private readonly Button _resetBtn = new() { Content = "Reset" };

        // --- UI elements ---
        private readonly StackPanel _root;

        public ExecutionPipeline()
        {
            _root = new StackPanel { Spacing = 4 };
            BuildUI();
            this.Content = _root;

            AutomationProperties.SetName(this, "Pipeline visualization showing sequential execution stages with status");

            this.KeyDown += OnKeyDown;
        }

        private void BuildUI()
        {
            _root.Children.Clear();
            _root.Children.Add(_failureBanner);
            _root.Children.Add(_stagesPanel);
            AutomationProperties.SetName(_stagesPanel, "Pipeline stages");

            _detailPanel.Visibility = Visibility.Collapsed;
            _root.Children.Add(_detailPanel);

            var actionBar = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            _retryBtn.Click += (s, e) => Send(WidgetEvent.RETRY);
            _resetBtn.Click += (s, e) => Send(WidgetEvent.RESET);
            actionBar.Children.Add(_retryBtn);
            actionBar.Children.Add(_resetBtn);
            _root.Children.Add(actionBar);
        }

        public void Send(WidgetEvent @event)
        {
            _state = Reduce(_state, @event);
            UpdateVisualState();
        }

        private static WidgetState Reduce(WidgetState state, WidgetEvent @event) => state switch
        {
            WidgetState.Idle => @event switch
            {
                WidgetEvent.ADVANCE => WidgetState.Idle,
                WidgetEvent.SELECT_STAGE => WidgetState.StageSelected,
                WidgetEvent.FAIL => WidgetState.Failed,
                _ => state
            },
            WidgetState.StageSelected => @event switch
            {
                WidgetEvent.DESELECT => WidgetState.Idle,
                _ => state
            },
            WidgetState.Failed => @event switch
            {
                WidgetEvent.RETRY => WidgetState.Idle,
                WidgetEvent.RESET => WidgetState.Idle,
                _ => state
            },
            _ => state
        };

        private void UpdateVisualState()
        {
            // Update visual properties based on current _state
        }

        private void OnKeyDown(object sender, Microsoft.UI.Xaml.Input.KeyRoutedEventArgs e)
        {
            if (e.Key == Windows.System.VirtualKey.Escape)
            {
                // Context-specific escape handling
            }
        }

        public void Dispose()
        {
            this.KeyDown -= OnKeyDown;
        }
    }
}
