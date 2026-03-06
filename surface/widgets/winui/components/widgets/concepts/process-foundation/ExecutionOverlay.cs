using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System;

namespace Clef.Surface.Widgets.Concepts.ProcessFoundation
{
    public sealed partial class ExecutionOverlay : UserControl
    {
        private enum WidgetState { Idle, Running, Paused, Complete, Error }
        private enum WidgetEvent { Start, Pause, Resume, Complete, Fail, Reset, StepChange }

        private WidgetState _state = WidgetState.Idle;
        private readonly Grid _root;
        private readonly StackPanel _overlay;
        private readonly TextBlock _statusText;
        private readonly ProgressRing _spinner;
        private readonly ProgressBar _progressBar;
        private readonly TextBlock _currentStepText;
        private readonly TextBlock _elapsedText;
        private readonly StackPanel _controlBar;
        private readonly Button _pauseButton;
        private readonly Button _cancelButton;
        private readonly TextBlock _errorText;
        private readonly TextBlock _completeBanner;
        private readonly DispatcherTimer _timer;
        private DateTime _startTime;
        private int _completedSteps = 0;
        private int _totalSteps = 0;

        public event Action OnPause;
        public event Action OnResume;
        public event Action OnCancel;

        public ExecutionOverlay()
        {
            _root = new Grid();
            _overlay = new StackPanel
            {
                Orientation = Orientation.Vertical,
                Spacing = 8,
                Padding = new Thickness(16),
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center
            };

            // Status
            var statusRow = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            _spinner = new ProgressRing { IsActive = false, Width = 20, Height = 20, Visibility = Visibility.Collapsed };
            _statusText = new TextBlock { Text = "Idle", FontSize = 16, FontWeight = Microsoft.UI.Text.FontWeights.Bold, VerticalAlignment = VerticalAlignment.Center };
            statusRow.Children.Add(_spinner);
            statusRow.Children.Add(_statusText);
            _overlay.Children.Add(statusRow);

            // Current step
            _currentStepText = new TextBlock { Text = "", FontSize = 13, Opacity = 0.8 };
            AutomationProperties.SetLiveSetting(_currentStepText, AutomationLiveSetting.Polite);
            _overlay.Children.Add(_currentStepText);

            // Progress
            _progressBar = new ProgressBar { Minimum = 0, Maximum = 100, Value = 0, Height = 6, Visibility = Visibility.Collapsed };
            AutomationProperties.SetName(_progressBar, "Execution progress");
            _overlay.Children.Add(_progressBar);

            // Elapsed time
            _elapsedText = new TextBlock { Text = "", FontSize = 11, Opacity = 0.6 };
            _overlay.Children.Add(_elapsedText);

            // Control bar
            _controlBar = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8, Visibility = Visibility.Collapsed };
            _pauseButton = new Button { Content = "Pause" };
            _pauseButton.Click += (s, e) =>
            {
                if (_state == WidgetState.Paused)
                {
                    Send(WidgetEvent.Resume);
                    OnResume?.Invoke();
                }
                else
                {
                    Send(WidgetEvent.Pause);
                    OnPause?.Invoke();
                }
            };
            AutomationProperties.SetName(_pauseButton, "Pause execution");
            _cancelButton = new Button { Content = "Cancel" };
            _cancelButton.Click += (s, e) => OnCancel?.Invoke();
            AutomationProperties.SetName(_cancelButton, "Cancel execution");
            _controlBar.Children.Add(_pauseButton);
            _controlBar.Children.Add(_cancelButton);
            _overlay.Children.Add(_controlBar);

            // Error text
            _errorText = new TextBlock
            {
                Text = "",
                FontSize = 12,
                Foreground = new SolidColorBrush(Colors.Red),
                TextWrapping = TextWrapping.Wrap,
                Visibility = Visibility.Collapsed
            };
            _overlay.Children.Add(_errorText);

            // Complete banner
            _completeBanner = new TextBlock
            {
                Text = "\u2713 Execution complete",
                FontSize = 14,
                Foreground = new SolidColorBrush(Colors.Green),
                FontWeight = Microsoft.UI.Text.FontWeights.Bold,
                Visibility = Visibility.Collapsed
            };
            _overlay.Children.Add(_completeBanner);

            // Timer
            _timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1) };
            _timer.Tick += (s, e) =>
            {
                var elapsed = DateTime.Now - _startTime;
                _elapsedText.Text = $"Elapsed: {elapsed:mm\\:ss}";
            };

            _root.Children.Add(_overlay);
            this.Content = _root;
            AutomationProperties.SetName(this, "Runtime state overlay for process execution monitoring");
        }

        public void SetTotalSteps(int total)
        {
            _totalSteps = total;
        }

        public void Start()
        {
            _startTime = DateTime.Now;
            _completedSteps = 0;
            Send(WidgetEvent.Start);
            _timer.Start();
        }

        public void SetCurrentStep(string stepName, int stepIndex)
        {
            _currentStepText.Text = $"Step {stepIndex + 1}/{_totalSteps}: {stepName}";
            _completedSteps = stepIndex;
            if (_totalSteps > 0)
                _progressBar.Value = (_completedSteps * 100.0 / _totalSteps);
            Send(WidgetEvent.StepChange);
        }

        public void SetComplete()
        {
            _timer.Stop();
            Send(WidgetEvent.Complete);
        }

        public void SetError(string error)
        {
            _timer.Stop();
            _errorText.Text = error;
            Send(WidgetEvent.Fail);
        }

        public void Send(WidgetEvent evt)
        {
            _state = Reduce(_state, evt);
            UpdateVisuals();
        }

        private void UpdateVisuals()
        {
            _spinner.IsActive = _state == WidgetState.Running;
            _spinner.Visibility = _state == WidgetState.Running ? Visibility.Visible : Visibility.Collapsed;
            _controlBar.Visibility = _state == WidgetState.Running || _state == WidgetState.Paused ? Visibility.Visible : Visibility.Collapsed;
            _progressBar.Visibility = _state == WidgetState.Running || _state == WidgetState.Paused ? Visibility.Visible : Visibility.Collapsed;
            _errorText.Visibility = _state == WidgetState.Error ? Visibility.Visible : Visibility.Collapsed;
            _completeBanner.Visibility = _state == WidgetState.Complete ? Visibility.Visible : Visibility.Collapsed;
            _pauseButton.Content = _state == WidgetState.Paused ? "Resume" : "Pause";
            _statusText.Text = _state switch
            {
                WidgetState.Idle => "Idle",
                WidgetState.Running => "Running",
                WidgetState.Paused => "Paused",
                WidgetState.Complete => "Complete",
                WidgetState.Error => "Error",
                _ => ""
            };
        }

        private WidgetState Reduce(WidgetState state, WidgetEvent evt) => state switch
        {
            WidgetState.Idle when evt == WidgetEvent.Start => WidgetState.Running,
            WidgetState.Running when evt == WidgetEvent.Pause => WidgetState.Paused,
            WidgetState.Running when evt == WidgetEvent.Complete => WidgetState.Complete,
            WidgetState.Running when evt == WidgetEvent.Fail => WidgetState.Error,
            WidgetState.Running when evt == WidgetEvent.StepChange => WidgetState.Running,
            WidgetState.Paused when evt == WidgetEvent.Resume => WidgetState.Running,
            WidgetState.Complete when evt == WidgetEvent.Reset => WidgetState.Idle,
            WidgetState.Error when evt == WidgetEvent.Reset => WidgetState.Idle,
            _ => state
        };
    }
}
