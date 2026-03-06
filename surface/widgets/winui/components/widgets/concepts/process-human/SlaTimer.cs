using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System;

namespace Clef.Surface.Widgets.Concepts.ProcessHuman
{
    public sealed partial class SlaTimer : UserControl
    {
        private enum WidgetState { OnTrack, Warning, Critical, Breached, Paused }
        private enum WidgetEvent { Tick, WarningThreshold, CriticalThreshold, Breach, Pause, Resume }

        private WidgetState _state = WidgetState.OnTrack;
        private readonly StackPanel _root;
        private readonly TextBlock _countdownText;
        private readonly TextBlock _phaseLabel;
        private readonly ProgressBar _progressBar;
        private readonly TextBlock _elapsedText;
        private readonly Button _pauseResumeButton;
        private readonly DispatcherTimer _timer;
        private DateTime _dueTime;
        private DateTime _startTime;
        private double _warningThreshold = 0.7;
        private double _criticalThreshold = 0.9;
        private bool _breachFired = false;
        private bool _warningFired = false;
        private bool _criticalFired = false;

        public event Action OnBreach;
        public event Action OnWarning;
        public event Action OnCritical;

        public SlaTimer()
        {
            _root = new StackPanel { Orientation = Orientation.Vertical, Spacing = 6, Padding = new Thickness(12) };

            // Countdown display
            _countdownText = new TextBlock { Text = "00:00:00", FontSize = 28, FontWeight = Microsoft.UI.Text.FontWeights.Bold };
            _root.Children.Add(_countdownText);

            // Phase label
            _phaseLabel = new TextBlock { Text = "On Track", FontSize = 13, Foreground = new SolidColorBrush(Colors.Green) };
            AutomationProperties.SetLiveSetting(_phaseLabel, AutomationLiveSetting.Polite);
            _root.Children.Add(_phaseLabel);

            // Progress bar
            _progressBar = new ProgressBar { Minimum = 0, Maximum = 100, Value = 0, Height = 8 };
            AutomationProperties.SetName(_progressBar, "SLA progress");
            _root.Children.Add(_progressBar);

            // Elapsed time
            _elapsedText = new TextBlock { Text = "", FontSize = 11, Opacity = 0.6 };
            _root.Children.Add(_elapsedText);

            // Pause/Resume button
            _pauseResumeButton = new Button { Content = "Pause" };
            _pauseResumeButton.Click += (s, e) =>
            {
                if (_state == WidgetState.Paused)
                    Send(WidgetEvent.Resume);
                else
                    Send(WidgetEvent.Pause);
            };
            AutomationProperties.SetName(_pauseResumeButton, "Pause timer");
            _root.Children.Add(_pauseResumeButton);

            // Timer
            _timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1) };
            _timer.Tick += (s, e) => Tick();

            this.Content = _root;
            AutomationProperties.SetName(this, "Five-state countdown timer for service level agreement tracking");
        }

        public void Start(string dueAt, string startedAt = null, double warningThreshold = 0.7, double criticalThreshold = 0.9)
        {
            _dueTime = DateTime.Parse(dueAt);
            _startTime = startedAt != null ? DateTime.Parse(startedAt) : DateTime.Now;
            _warningThreshold = warningThreshold;
            _criticalThreshold = criticalThreshold;
            _breachFired = false;
            _warningFired = false;
            _criticalFired = false;
            _timer.Start();
            Tick();
        }

        private void Tick()
        {
            var now = DateTime.Now;
            var remaining = _dueTime - now;
            var elapsed = now - _startTime;
            var totalDuration = _dueTime - _startTime;
            double progress = totalDuration.TotalMilliseconds > 0 ? Math.Min(1.0, elapsed.TotalMilliseconds / totalDuration.TotalMilliseconds) : 1.0;

            // Update display
            if (remaining.TotalMilliseconds <= 0)
            {
                _countdownText.Text = "BREACHED";
            }
            else
            {
                _countdownText.Text = $"{(int)remaining.TotalHours:D2}:{remaining.Minutes:D2}:{remaining.Seconds:D2}";
            }

            _progressBar.Value = progress * 100;
            _elapsedText.Text = FormatElapsed(elapsed);

            Send(WidgetEvent.Tick);

            // Check thresholds
            if (remaining.TotalMilliseconds <= 0 && !_breachFired)
            {
                _breachFired = true;
                Send(WidgetEvent.Breach);
                OnBreach?.Invoke();
            }
            else if (progress >= _criticalThreshold && !_criticalFired && remaining.TotalMilliseconds > 0)
            {
                _criticalFired = true;
                Send(WidgetEvent.CriticalThreshold);
                OnCritical?.Invoke();
            }
            else if (progress >= _warningThreshold && !_warningFired && remaining.TotalMilliseconds > 0)
            {
                _warningFired = true;
                Send(WidgetEvent.WarningThreshold);
                OnWarning?.Invoke();
            }
        }

        private string FormatElapsed(TimeSpan ts)
        {
            if (ts.TotalHours >= 1) return $"Elapsed: {(int)ts.TotalHours}h {ts.Minutes}m {ts.Seconds}s";
            if (ts.TotalMinutes >= 1) return $"Elapsed: {ts.Minutes}m {ts.Seconds}s";
            return $"Elapsed: {ts.Seconds}s";
        }

        public void Send(WidgetEvent evt)
        {
            _state = Reduce(_state, evt);
            UpdateVisuals();
        }

        private void UpdateVisuals()
        {
            var (label, color) = _state switch
            {
                WidgetState.OnTrack => ("On Track", Colors.Green),
                WidgetState.Warning => ("Warning", Colors.Orange),
                WidgetState.Critical => ("Critical", Colors.OrangeRed),
                WidgetState.Breached => ("Breached", Colors.Red),
                WidgetState.Paused => ("Paused", Colors.Gray),
                _ => ("", Colors.Gray)
            };

            _phaseLabel.Text = label;
            _phaseLabel.Foreground = new SolidColorBrush(color);
            _pauseResumeButton.Content = _state == WidgetState.Paused ? "Resume" : "Pause";
            _pauseResumeButton.Visibility = _state != WidgetState.Breached ? Visibility.Visible : Visibility.Collapsed;

            if (_state == WidgetState.Paused)
                _timer.Stop();
            else if (_state != WidgetState.Breached && !_timer.IsEnabled)
                _timer.Start();
        }

        private WidgetState Reduce(WidgetState state, WidgetEvent evt) => state switch
        {
            WidgetState.OnTrack when evt == WidgetEvent.Tick => WidgetState.OnTrack,
            WidgetState.OnTrack when evt == WidgetEvent.WarningThreshold => WidgetState.Warning,
            WidgetState.OnTrack when evt == WidgetEvent.Pause => WidgetState.Paused,
            WidgetState.Warning when evt == WidgetEvent.Tick => WidgetState.Warning,
            WidgetState.Warning when evt == WidgetEvent.CriticalThreshold => WidgetState.Critical,
            WidgetState.Warning when evt == WidgetEvent.Pause => WidgetState.Paused,
            WidgetState.Critical when evt == WidgetEvent.Tick => WidgetState.Critical,
            WidgetState.Critical when evt == WidgetEvent.Breach => WidgetState.Breached,
            WidgetState.Critical when evt == WidgetEvent.Pause => WidgetState.Paused,
            WidgetState.Breached when evt == WidgetEvent.Tick => WidgetState.Breached,
            WidgetState.Paused when evt == WidgetEvent.Resume => WidgetState.OnTrack,
            _ => state
        };
    }
}
