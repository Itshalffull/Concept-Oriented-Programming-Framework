using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System;

namespace Clef.Surface.Widgets.Concepts.LlmAgent
{
    public sealed partial class ToolInvocation : UserControl
    {
        private enum WidgetState { Collapsed, Expanded, Running, Error }
        private enum WidgetEvent { Toggle, Run, Complete, Fail, Retry }

        private WidgetState _state = WidgetState.Collapsed;
        private readonly StackPanel _root;
        private readonly StackPanel _header;
        private readonly Button _toggleButton;
        private readonly TextBlock _toolName;
        private readonly TextBlock _statusBadge;
        private readonly TextBlock _durationText;
        private readonly ProgressRing _runningIndicator;
        private readonly Border _contentBorder;
        private readonly StackPanel _contentPanel;
        private readonly TextBlock _inputLabel;
        private readonly TextBlock _inputText;
        private readonly TextBlock _outputLabel;
        private readonly TextBlock _outputText;
        private readonly TextBlock _errorText;
        private readonly Button _retryButton;

        public event Action OnRetry;

        public ToolInvocation()
        {
            _root = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4 };

            // Header
            _header = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8, Padding = new Thickness(8, 4, 8, 4) };
            _toggleButton = new Button { Content = "\u25B6", FontSize = 12, Padding = new Thickness(4) };
            _toggleButton.Click += (s, e) => Send(WidgetEvent.Toggle);
            AutomationProperties.SetName(_toggleButton, "Toggle tool invocation details");

            _toolName = new TextBlock { Text = "", FontSize = 13, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold, VerticalAlignment = VerticalAlignment.Center };
            _statusBadge = new TextBlock { Text = "", FontSize = 11, VerticalAlignment = VerticalAlignment.Center };
            _durationText = new TextBlock { Text = "", FontSize = 11, Opacity = 0.6, VerticalAlignment = VerticalAlignment.Center };
            _runningIndicator = new ProgressRing { IsActive = false, Width = 14, Height = 14, Visibility = Visibility.Collapsed };

            _header.Children.Add(_toggleButton);
            _header.Children.Add(new TextBlock { Text = "\u2699", FontSize = 13, VerticalAlignment = VerticalAlignment.Center });
            _header.Children.Add(_toolName);
            _header.Children.Add(_runningIndicator);
            _header.Children.Add(_statusBadge);
            _header.Children.Add(_durationText);
            _root.Children.Add(_header);

            // Content area
            _contentBorder = new Border
            {
                Padding = new Thickness(12, 8, 12, 8),
                Visibility = Visibility.Collapsed,
                BorderThickness = new Thickness(2, 0, 0, 0),
                BorderBrush = new SolidColorBrush(Colors.Gray)
            };
            _contentPanel = new StackPanel { Orientation = Orientation.Vertical, Spacing = 8 };

            // Input section
            _inputLabel = new TextBlock { Text = "Input", FontSize = 12, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
            _inputText = new TextBlock { Text = "", FontSize = 12, TextWrapping = TextWrapping.Wrap, IsTextSelectionEnabled = true };
            _contentPanel.Children.Add(_inputLabel);
            _contentPanel.Children.Add(_inputText);

            // Output section
            _outputLabel = new TextBlock { Text = "Output", FontSize = 12, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
            _outputText = new TextBlock { Text = "", FontSize = 12, TextWrapping = TextWrapping.Wrap, IsTextSelectionEnabled = true };
            _contentPanel.Children.Add(_outputLabel);
            _contentPanel.Children.Add(_outputText);

            // Error section (hidden)
            _errorText = new TextBlock
            {
                Text = "",
                FontSize = 12,
                Foreground = new SolidColorBrush(Colors.Red),
                TextWrapping = TextWrapping.Wrap,
                Visibility = Visibility.Collapsed
            };
            _contentPanel.Children.Add(_errorText);

            // Retry button (hidden)
            _retryButton = new Button { Content = "Retry", Visibility = Visibility.Collapsed };
            _retryButton.Click += (s, e) =>
            {
                Send(WidgetEvent.Retry);
                OnRetry?.Invoke();
            };
            AutomationProperties.SetName(_retryButton, "Retry tool invocation");
            _contentPanel.Children.Add(_retryButton);

            _contentBorder.Child = _contentPanel;
            _root.Children.Add(_contentBorder);

            this.Content = _root;
            AutomationProperties.SetName(this, "Collapsible card displaying an LLM tool invocation");
        }

        public void SetTool(string name, string input, string output = null, string status = "complete", string duration = null)
        {
            _toolName.Text = name;
            _inputText.Text = input;
            _outputText.Text = output ?? "";
            _durationText.Text = duration ?? "";

            _statusBadge.Text = status switch
            {
                "complete" => "\u2611 Complete",
                "running" => "",
                "error" => "\u2717 Error",
                _ => status
            };

            if (status == "running") Send(WidgetEvent.Run);
            else if (status == "error") Send(WidgetEvent.Fail);
        }

        public void SetError(string error)
        {
            _errorText.Text = error;
            Send(WidgetEvent.Fail);
        }

        public void SetOutput(string output, string duration = null)
        {
            _outputText.Text = output;
            if (duration != null) _durationText.Text = duration;
            Send(WidgetEvent.Complete);
        }

        public void Send(WidgetEvent evt)
        {
            _state = Reduce(_state, evt);
            UpdateVisuals();
        }

        private void UpdateVisuals()
        {
            bool showContent = _state != WidgetState.Collapsed;
            _contentBorder.Visibility = showContent ? Visibility.Visible : Visibility.Collapsed;
            _toggleButton.Content = showContent ? "\u25BC" : "\u25B6";
            _runningIndicator.IsActive = _state == WidgetState.Running;
            _runningIndicator.Visibility = _state == WidgetState.Running ? Visibility.Visible : Visibility.Collapsed;
            _errorText.Visibility = _state == WidgetState.Error ? Visibility.Visible : Visibility.Collapsed;
            _retryButton.Visibility = _state == WidgetState.Error ? Visibility.Visible : Visibility.Collapsed;
            _outputLabel.Visibility = _state != WidgetState.Running ? Visibility.Visible : Visibility.Collapsed;
            _outputText.Visibility = _state != WidgetState.Running ? Visibility.Visible : Visibility.Collapsed;
        }

        private WidgetState Reduce(WidgetState state, WidgetEvent evt) => state switch
        {
            WidgetState.Collapsed when evt == WidgetEvent.Toggle => WidgetState.Expanded,
            WidgetState.Collapsed when evt == WidgetEvent.Run => WidgetState.Running,
            WidgetState.Expanded when evt == WidgetEvent.Toggle => WidgetState.Collapsed,
            WidgetState.Running when evt == WidgetEvent.Complete => WidgetState.Expanded,
            WidgetState.Running when evt == WidgetEvent.Fail => WidgetState.Error,
            WidgetState.Error when evt == WidgetEvent.Retry => WidgetState.Running,
            WidgetState.Error when evt == WidgetEvent.Toggle => WidgetState.Collapsed,
            _ => state
        };
    }
}
