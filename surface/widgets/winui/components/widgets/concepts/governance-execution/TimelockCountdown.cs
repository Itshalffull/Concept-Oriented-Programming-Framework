using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Dispatching;

namespace Clef.Surface.Widgets.Concepts.GovernanceExecution
{
    /// <summary>
    /// Countdown timer for timelock-gated governance actions with execute/challenge
    /// </summary>
    public sealed partial class TimelockCountdown : UserControl, IDisposable
    {
        private enum WidgetState
        {
        Running,
        Warning,
        Critical,
        Expired,
        Executing,
        Completed,
        Paused
        }

        private enum WidgetEvent
        {
        TICK,
        WARNING_THRESHOLD,
        EXPIRE,
        PAUSE,
        CRITICAL_THRESHOLD,
        EXECUTE,
        RESET,
        EXECUTE_COMPLETE,
        EXECUTE_ERROR,
        RESUME,
        CHALLENGE
        }

        private WidgetState _state = WidgetState.Running;
        private DispatcherTimer? _timer;
        private long _remainingMs = 0;
        private readonly TextBlock _countdownText = new() { FontSize = 24, FontWeight = Microsoft.UI.Text.FontWeights.Bold };
        private readonly ProgressBar _progressBar = new() { Minimum = 0, Maximum = 100 };
        private readonly TextBlock _phaseLabel = new();
        private readonly Button _executeBtn = new() { Content = "Execute" };
        private readonly Button _challengeBtn = new() { Content = "Challenge" };
        private readonly Button _pauseBtn = new() { Content = "Pause" };
        private readonly Button _resumeBtn = new() { Content = "Resume" };

        // --- UI elements ---
        private readonly StackPanel _root;

        public TimelockCountdown()
        {
            _root = new StackPanel { Spacing = 4 };
            BuildUI();
            this.Content = _root;

            AutomationProperties.SetName(this, "Countdown timer for timelock-gated governance actions with execute/challenge");

            this.KeyDown += OnKeyDown;
        }

        private void BuildUI()
        {
            _root.Children.Clear();
            _root.Children.Add(_countdownText);
            _root.Children.Add(_progressBar);
            AutomationProperties.SetName(_progressBar, "Timelock countdown progress");
            _root.Children.Add(_phaseLabel);

            var actionBar = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            _executeBtn.Click += (s, e) => Send(WidgetEvent.EXECUTE);
            _challengeBtn.Click += (s, e) => Send(WidgetEvent.CHALLENGE);
            _pauseBtn.Click += (s, e) => Send(WidgetEvent.PAUSE);
            _resumeBtn.Click += (s, e) => Send(WidgetEvent.RESUME);
            actionBar.Children.Add(_executeBtn);
            actionBar.Children.Add(_challengeBtn);
            actionBar.Children.Add(_pauseBtn);
            actionBar.Children.Add(_resumeBtn);
            _root.Children.Add(actionBar);
        }

        public void Send(WidgetEvent @event)
        {
            _state = Reduce(_state, @event);
            UpdateVisualState();
        }

        private static WidgetState Reduce(WidgetState state, WidgetEvent @event) => state switch
        {
            WidgetState.Running => @event switch
            {
                WidgetEvent.TICK => WidgetState.Running,
                WidgetEvent.WARNING_THRESHOLD => WidgetState.Warning,
                WidgetEvent.EXPIRE => WidgetState.Expired,
                WidgetEvent.PAUSE => WidgetState.Paused,
                _ => state
            },
            WidgetState.Warning => @event switch
            {
                WidgetEvent.TICK => WidgetState.Warning,
                WidgetEvent.CRITICAL_THRESHOLD => WidgetState.Critical,
                WidgetEvent.EXPIRE => WidgetState.Expired,
                _ => state
            },
            WidgetState.Critical => @event switch
            {
                WidgetEvent.TICK => WidgetState.Critical,
                WidgetEvent.EXPIRE => WidgetState.Expired,
                _ => state
            },
            WidgetState.Expired => @event switch
            {
                WidgetEvent.EXECUTE => WidgetState.Executing,
                WidgetEvent.RESET => WidgetState.Running,
                _ => state
            },
            WidgetState.Executing => @event switch
            {
                WidgetEvent.EXECUTE_COMPLETE => WidgetState.Completed,
                WidgetEvent.EXECUTE_ERROR => WidgetState.Expired,
                _ => state
            },
            WidgetState.Completed => @event switch
            {
                _ => state
            },
            WidgetState.Paused => @event switch
            {
                WidgetEvent.RESUME => WidgetState.Running,
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

        public void StartCountdown(long totalMs)
        {
            _remainingMs = totalMs;
            _timer = new DispatcherTimer { Interval = System.TimeSpan.FromSeconds(1) };
            _timer.Tick += (s, e) =>
            {
                _remainingMs -= 1000;
                if (_remainingMs <= 0) { _timer?.Stop(); Send(WidgetEvent.EXPIRE); }
                else { Send(WidgetEvent.TICK); }
                UpdateCountdownDisplay();
            };
            _timer.Start();
        }

        private void UpdateCountdownDisplay()
        {
            var ts = System.TimeSpan.FromMilliseconds(System.Math.Max(0, _remainingMs));
            _countdownText.Text = ts.ToString(@"hh\:mm\:ss");
        }

        public void Dispose()
        {
            if (_timer != null) { _timer.Stop(); _timer = null; }
            this.KeyDown -= OnKeyDown;
        }
    }
}
