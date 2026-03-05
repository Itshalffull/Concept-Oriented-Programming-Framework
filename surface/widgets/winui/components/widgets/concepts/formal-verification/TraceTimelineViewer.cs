using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Dispatching;

namespace Clef.Surface.Widgets.Concepts.FormalVerification
{
    /// <summary>
    /// Timeline viewer showing variable lanes across verification trace steps
    /// </summary>
    public sealed partial class TraceTimelineViewer : UserControl, IDisposable
    {
        private enum WidgetState
        {
        Idle,
        Playing,
        CellSelected
        }

        private enum WidgetEvent
        {
        PLAY,
        STEP_FORWARD,
        STEP_BACKWARD,
        SELECT_CELL,
        ZOOM,
        PAUSE,
        STEP_END,
        DESELECT
        }

        private WidgetState _state = WidgetState.Idle;
        private DispatcherTimer? _timer;
        private int _currentStep = 0;
        private readonly ScrollViewer _timelineArea = new();
        private readonly StackPanel _lanesPanel = new();
        private readonly StackPanel _detailPanel = new();

        // --- UI elements ---
        private readonly StackPanel _root;

        public TraceTimelineViewer()
        {
            _root = new StackPanel { Spacing = 4 };
            BuildUI();
            this.Content = _root;

            AutomationProperties.SetName(this, "Timeline viewer showing variable lanes across verification trace steps");

            this.KeyDown += OnKeyDown;
        }

        private void BuildUI()
        {
            _root.Children.Clear();
            _timelineArea.Content = _lanesPanel;
            AutomationProperties.SetName(_timelineArea, "Trace timeline");
            _root.Children.Add(_timelineArea);
            _detailPanel.Visibility = Visibility.Collapsed;
            _root.Children.Add(_detailPanel);
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
                WidgetEvent.PLAY => WidgetState.Playing,
                WidgetEvent.STEP_FORWARD => WidgetState.Idle,
                WidgetEvent.STEP_BACKWARD => WidgetState.Idle,
                WidgetEvent.SELECT_CELL => WidgetState.CellSelected,
                WidgetEvent.ZOOM => WidgetState.Idle,
                _ => state
            },
            WidgetState.Playing => @event switch
            {
                WidgetEvent.PAUSE => WidgetState.Idle,
                WidgetEvent.STEP_END => WidgetState.Idle,
                _ => state
            },
            WidgetState.CellSelected => @event switch
            {
                WidgetEvent.DESELECT => WidgetState.Idle,
                WidgetEvent.SELECT_CELL => WidgetState.CellSelected,
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
            if (_timer != null) { _timer.Stop(); _timer = null; }
            this.KeyDown -= OnKeyDown;
        }
    }
}
