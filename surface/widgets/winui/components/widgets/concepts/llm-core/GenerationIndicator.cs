using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System;

namespace Clef.Surface.Widgets.Concepts.LlmCore
{
    public sealed partial class GenerationIndicator : UserControl
    {
        private enum WidgetState { Idle, Generating, Queued, Complete, Error }
        private enum WidgetEvent { Start, Queue, Complete, Fail, Reset, Token }

        private WidgetState _state = WidgetState.Idle;
        private readonly StackPanel _root;
        private readonly StackPanel _statusRow;
        private readonly ProgressRing _spinner;
        private readonly TextBlock _statusText;
        private readonly TextBlock _modelText;
        private readonly ProgressBar _progressBar;
        private readonly TextBlock _tokenCountText;
        private readonly TextBlock _elapsedText;
        private readonly TextBlock _errorText;
        private readonly Button _cancelButton;
        private readonly DispatcherTimer _timer;
        private int _tokenCount = 0;
        private DateTime _startTime;
        private int _estimatedTotal = 0;

        public event Action OnCancel;

        public GenerationIndicator()
        {
            _root = new StackPanel { Orientation = Orientation.Vertical, Spacing = 6, Padding = new Thickness(8) };

            // Status row
            _statusRow = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            _spinner = new ProgressRing { IsActive = false, Width = 16, Height = 16, Visibility = Visibility.Collapsed };
            _statusText = new TextBlock { Text = "Idle", FontSize = 13, VerticalAlignment = VerticalAlignment.Center };
            _modelText = new TextBlock { Text = "", FontSize = 11, Opacity = 0.6, VerticalAlignment = VerticalAlignment.Center };
            _cancelButton = new Button { Content = "Cancel", FontSize = 11, Visibility = Visibility.Collapsed };
            _cancelButton.Click += (s, e) => OnCancel?.Invoke();
            AutomationProperties.SetName(_cancelButton, "Cancel generation");
            _statusRow.Children.Add(_spinner);
            _statusRow.Children.Add(_statusText);
            _statusRow.Children.Add(_modelText);
            _statusRow.Children.Add(_cancelButton);
            _root.Children.Add(_statusRow);

            // Progress bar
            _progressBar = new ProgressBar { Minimum = 0, Maximum = 100, Value = 0, Height = 4, Visibility = Visibility.Collapsed };
            AutomationProperties.SetName(_progressBar, "Generation progress");
            _root.Children.Add(_progressBar);

            // Stats row
            var statsRow = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 12 };
            _tokenCountText = new TextBlock { Text = "", FontSize = 11, Opacity = 0.6 };
            _elapsedText = new TextBlock { Text = "", FontSize = 11, Opacity = 0.6 };
            statsRow.Children.Add(_tokenCountText);
            statsRow.Children.Add(_elapsedText);
            _root.Children.Add(statsRow);

            // Error text
            _errorText = new TextBlock
            {
                Text = "",
                FontSize = 12,
                Foreground = new SolidColorBrush(Colors.Red),
                TextWrapping = TextWrapping.Wrap,
                Visibility = Visibility.Collapsed
            };
            _root.Children.Add(_errorText);

            // Elapsed time timer
            _timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1) };
            _timer.Tick += (s, e) =>
            {
                var elapsed = DateTime.Now - _startTime;
                _elapsedText.Text = $"{elapsed.TotalSeconds:F0}s";
            };

            this.Content = _root;
            AutomationProperties.SetName(this, "Status indicator for LLM generation in progress");
            AutomationProperties.SetLiveSetting(this, AutomationLiveSetting.Polite);
        }

        public void SetModel(string model) => _modelText.Text = model;
        public void SetEstimatedTokens(int total) { _estimatedTotal = total; }

        public void Start()
        {
            _tokenCount = 0;
            _startTime = DateTime.Now;
            Send(WidgetEvent.Start);
            _timer.Start();
        }

        public void AddToken()
        {
            _tokenCount++;
            _tokenCountText.Text = $"{_tokenCount} tokens";
            if (_estimatedTotal > 0)
            {
                _progressBar.Value = Math.Min(100, (_tokenCount * 100.0 / _estimatedTotal));
            }
            Send(WidgetEvent.Token);
        }

        public void Complete()
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

        public void SetQueued(int position = 0)
        {
            _statusText.Text = position > 0 ? $"Queued (position {position})" : "Queued";
            Send(WidgetEvent.Queue);
        }

        public void Send(WidgetEvent evt)
        {
            _state = Reduce(_state, evt);
            UpdateVisuals();
        }

        private void UpdateVisuals()
        {
            _spinner.IsActive = _state == WidgetState.Generating;
            _spinner.Visibility = _state == WidgetState.Generating ? Visibility.Visible : Visibility.Collapsed;
            _cancelButton.Visibility = _state == WidgetState.Generating || _state == WidgetState.Queued ? Visibility.Visible : Visibility.Collapsed;
            _progressBar.Visibility = _state == WidgetState.Generating && _estimatedTotal > 0 ? Visibility.Visible : Visibility.Collapsed;
            _errorText.Visibility = _state == WidgetState.Error ? Visibility.Visible : Visibility.Collapsed;
            _statusText.Text = _state switch
            {
                WidgetState.Idle => "Idle",
                WidgetState.Generating => "Generating...",
                WidgetState.Queued => _statusText.Text,
                WidgetState.Complete => "Complete",
                WidgetState.Error => "Error",
                _ => ""
            };
        }

        private WidgetState Reduce(WidgetState state, WidgetEvent evt) => state switch
        {
            WidgetState.Idle when evt == WidgetEvent.Start => WidgetState.Generating,
            WidgetState.Idle when evt == WidgetEvent.Queue => WidgetState.Queued,
            WidgetState.Queued when evt == WidgetEvent.Start => WidgetState.Generating,
            WidgetState.Generating when evt == WidgetEvent.Token => WidgetState.Generating,
            WidgetState.Generating when evt == WidgetEvent.Complete => WidgetState.Complete,
            WidgetState.Generating when evt == WidgetEvent.Fail => WidgetState.Error,
            WidgetState.Complete when evt == WidgetEvent.Reset => WidgetState.Idle,
            WidgetState.Complete when evt == WidgetEvent.Start => WidgetState.Generating,
            WidgetState.Error when evt == WidgetEvent.Reset => WidgetState.Idle,
            WidgetState.Error when evt == WidgetEvent.Start => WidgetState.Generating,
            _ => state
        };
    }
}
