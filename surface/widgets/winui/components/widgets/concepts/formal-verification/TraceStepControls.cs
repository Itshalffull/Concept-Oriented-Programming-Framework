using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Dispatching;

namespace Clef.Surface.Widgets.Concepts.FormalVerification
{
    /// <summary>
    /// Transport controls for stepping through verification traces
    /// </summary>
    public sealed partial class TraceStepControls : UserControl, IDisposable
    {
        private enum WidgetState
        {
        Paused,
        Playing
        }

        private enum WidgetEvent
        {
        PLAY,
        STEP_FWD,
        STEP_BACK,
        JUMP_START,
        JUMP_END,
        PAUSE,
        REACH_END
        }

        private WidgetState _state = WidgetState.Paused;
        private DispatcherTimer? _timer;
        private int _currentStep = 0;
        private int _totalSteps = 0;
        private int _speed = 1;
        private readonly Button _playBtn = new() { Content = "\u25B6" };
        private readonly Button _pauseBtn = new() { Content = "\u23F8" };
        private readonly Button _stepFwdBtn = new() { Content = "\u23ED" };
        private readonly Button _stepBackBtn = new() { Content = "\u23EE" };
        private readonly Button _jumpStartBtn = new() { Content = "\u23EE\u23EE" };
        private readonly Button _jumpEndBtn = new() { Content = "\u23ED\u23ED" };
        private readonly TextBlock _stepLabel = new();
        private readonly ProgressBar _progressBar = new() { Minimum = 0 };

        // --- UI elements ---
        private readonly StackPanel _root;

        public TraceStepControls()
        {
            _root = new StackPanel { Spacing = 4 };
            BuildUI();
            this.Content = _root;

            AutomationProperties.SetName(this, "Transport controls for stepping through verification traces");

            this.KeyDown += OnKeyDown;
        }

        private void BuildUI()
        {
            _root.Children.Clear();
            var transport = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            _jumpStartBtn.Click += (s, e) => Send(WidgetEvent.JUMP_START);
            _stepBackBtn.Click += (s, e) => Send(WidgetEvent.STEP_BACK);
            _playBtn.Click += (s, e) => Send(WidgetEvent.PLAY);
            _pauseBtn.Click += (s, e) => Send(WidgetEvent.PAUSE);
            _stepFwdBtn.Click += (s, e) => Send(WidgetEvent.STEP_FWD);
            _jumpEndBtn.Click += (s, e) => Send(WidgetEvent.JUMP_END);
            transport.Children.Add(_jumpStartBtn);
            transport.Children.Add(_stepBackBtn);
            transport.Children.Add(_playBtn);
            transport.Children.Add(_pauseBtn);
            transport.Children.Add(_stepFwdBtn);
            transport.Children.Add(_jumpEndBtn);
            transport.Children.Add(_stepLabel);
            _root.Children.Add(transport);
            _root.Children.Add(_progressBar);
            AutomationProperties.SetName(_progressBar, "Trace step progress");
        }

        public void Send(WidgetEvent @event)
        {
            _state = Reduce(_state, @event);
            UpdateVisualState();
        }

        private static WidgetState Reduce(WidgetState state, WidgetEvent @event) => state switch
        {
            WidgetState.Paused => @event switch
            {
                WidgetEvent.PLAY => WidgetState.Playing,
                WidgetEvent.STEP_FWD => WidgetState.Paused,
                WidgetEvent.STEP_BACK => WidgetState.Paused,
                WidgetEvent.JUMP_START => WidgetState.Paused,
                WidgetEvent.JUMP_END => WidgetState.Paused,
                _ => state
            },
            WidgetState.Playing => @event switch
            {
                WidgetEvent.PAUSE => WidgetState.Paused,
                WidgetEvent.REACH_END => WidgetState.Paused,
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
