using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System;

namespace Clef.Surface.Widgets.Concepts.LlmSafety
{
    public sealed partial class ExecutionMetricsPanel : UserControl
    {
        private enum WidgetState { Idle, Monitoring, Paused, Alert }
        private enum WidgetEvent { StartMonitoring, Pause, Resume, Alert, Dismiss, Update }

        private WidgetState _state = WidgetState.Idle;
        private readonly StackPanel _root;
        private readonly TextBlock _title;
        private readonly StackPanel _metricsGrid;
        private readonly StackPanel _alertBanner;
        private readonly TextBlock _alertText;
        private readonly Button _dismissAlert;
        private readonly StackPanel _controlBar;
        private readonly Button _startButton;
        private readonly Button _pauseButton;
        private readonly TextBlock _lastUpdated;
        private readonly DispatcherTimer _timer;

        public event Action OnStart;
        public event Action OnPause;

        public ExecutionMetricsPanel()
        {
            _root = new StackPanel { Orientation = Orientation.Vertical, Spacing = 8, Padding = new Thickness(12) };

            // Header
            _title = new TextBlock { Text = "Execution Metrics", FontSize = 16, FontWeight = Microsoft.UI.Text.FontWeights.Bold };
            _root.Children.Add(_title);

            // Alert banner (hidden)
            _alertBanner = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8, Visibility = Visibility.Collapsed, Padding = new Thickness(8) };
            _alertBanner.Background = new SolidColorBrush(Colors.OrangeRed);
            _alertText = new TextBlock { Text = "", FontSize = 13, Foreground = new SolidColorBrush(Colors.White), VerticalAlignment = VerticalAlignment.Center };
            _dismissAlert = new Button { Content = "\u2715", FontSize = 11 };
            _dismissAlert.Click += (s, e) => Send(WidgetEvent.Dismiss);
            AutomationProperties.SetName(_dismissAlert, "Dismiss alert");
            AutomationProperties.SetLiveSetting(_alertBanner, AutomationLiveSetting.Assertive);
            _alertBanner.Children.Add(_alertText);
            _alertBanner.Children.Add(_dismissAlert);
            _root.Children.Add(_alertBanner);

            // Metrics grid
            _metricsGrid = new StackPanel { Orientation = Orientation.Vertical, Spacing = 8 };
            _root.Children.Add(_metricsGrid);

            // Control bar
            _controlBar = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            _startButton = new Button { Content = "Start Monitoring" };
            _startButton.Click += (s, e) =>
            {
                Send(WidgetEvent.StartMonitoring);
                OnStart?.Invoke();
            };
            AutomationProperties.SetName(_startButton, "Start monitoring");
            _pauseButton = new Button { Content = "Pause", Visibility = Visibility.Collapsed };
            _pauseButton.Click += (s, e) =>
            {
                if (_state == WidgetState.Paused)
                {
                    Send(WidgetEvent.Resume);
                }
                else
                {
                    Send(WidgetEvent.Pause);
                    OnPause?.Invoke();
                }
            };
            AutomationProperties.SetName(_pauseButton, "Pause monitoring");
            _lastUpdated = new TextBlock { Text = "", FontSize = 11, Opacity = 0.5, VerticalAlignment = VerticalAlignment.Center };
            _controlBar.Children.Add(_startButton);
            _controlBar.Children.Add(_pauseButton);
            _controlBar.Children.Add(_lastUpdated);
            _root.Children.Add(_controlBar);

            // Auto-update timer
            _timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(5) };
            _timer.Tick += (s, e) =>
            {
                _lastUpdated.Text = $"Updated: {DateTime.Now:HH:mm:ss}";
                Send(WidgetEvent.Update);
            };

            this.Content = _root;
            AutomationProperties.SetName(this, "Dashboard panel displaying LLM execution metrics and safety indicators");
        }

        public void AddMetric(string label, string value, string trend = null, string threshold = null)
        {
            var card = new Border { Padding = new Thickness(8), CornerRadius = new CornerRadius(4), BorderThickness = new Thickness(1), BorderBrush = new SolidColorBrush(Colors.Gray) };
            var cardContent = new StackPanel { Orientation = Orientation.Vertical, Spacing = 2 };
            var labelText = new TextBlock { Text = label, FontSize = 12, Opacity = 0.7 };
            var valueText = new TextBlock { Text = value, FontSize = 20, FontWeight = Microsoft.UI.Text.FontWeights.Bold };
            cardContent.Children.Add(labelText);
            cardContent.Children.Add(valueText);

            if (trend != null)
            {
                var trendText = new TextBlock { Text = trend, FontSize = 11, Opacity = 0.6 };
                cardContent.Children.Add(trendText);
            }
            if (threshold != null)
            {
                var thresholdText = new TextBlock { Text = $"Threshold: {threshold}", FontSize = 11, Opacity = 0.5 };
                cardContent.Children.Add(thresholdText);
            }

            card.Child = cardContent;
            AutomationProperties.SetName(card, $"{label}: {value}");
            _metricsGrid.Children.Add(card);
        }

        public void SetAlert(string message)
        {
            _alertText.Text = message;
            Send(WidgetEvent.Alert);
        }

        public void UpdateMetric(int index, string value)
        {
            if (index < _metricsGrid.Children.Count && _metricsGrid.Children[index] is Border border && border.Child is StackPanel panel && panel.Children.Count > 1)
            {
                if (panel.Children[1] is TextBlock valueText)
                    valueText.Text = value;
            }
        }

        public void Send(WidgetEvent evt)
        {
            _state = Reduce(_state, evt);
            UpdateVisuals();
        }

        private void UpdateVisuals()
        {
            _alertBanner.Visibility = _state == WidgetState.Alert ? Visibility.Visible : Visibility.Collapsed;
            _startButton.Visibility = _state == WidgetState.Idle ? Visibility.Visible : Visibility.Collapsed;
            _pauseButton.Visibility = _state == WidgetState.Monitoring || _state == WidgetState.Paused ? Visibility.Visible : Visibility.Collapsed;
            _pauseButton.Content = _state == WidgetState.Paused ? "Resume" : "Pause";

            if (_state == WidgetState.Monitoring && !_timer.IsEnabled) _timer.Start();
            else if (_state != WidgetState.Monitoring && _timer.IsEnabled) _timer.Stop();
        }

        private WidgetState Reduce(WidgetState state, WidgetEvent evt) => state switch
        {
            WidgetState.Idle when evt == WidgetEvent.StartMonitoring => WidgetState.Monitoring,
            WidgetState.Monitoring when evt == WidgetEvent.Pause => WidgetState.Paused,
            WidgetState.Monitoring when evt == WidgetEvent.Alert => WidgetState.Alert,
            WidgetState.Monitoring when evt == WidgetEvent.Update => WidgetState.Monitoring,
            WidgetState.Paused when evt == WidgetEvent.Resume => WidgetState.Monitoring,
            WidgetState.Alert when evt == WidgetEvent.Dismiss => WidgetState.Monitoring,
            _ => state
        };
    }
}
