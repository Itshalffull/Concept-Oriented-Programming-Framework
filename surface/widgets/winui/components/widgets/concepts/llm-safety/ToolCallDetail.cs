using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System;

namespace Clef.Surface.Widgets.Concepts.LlmSafety
{
    public sealed partial class ToolCallDetail : UserControl
    {
        private enum WidgetState { Idle, Expanded, Reviewing, Approved, Rejected }
        private enum WidgetEvent { Toggle, Review, Approve, Reject, Reset }

        private WidgetState _state = WidgetState.Idle;
        private readonly StackPanel _root;
        private readonly StackPanel _header;
        private readonly Button _toggleButton;
        private readonly TextBlock _toolName;
        private readonly TextBlock _statusBadge;
        private readonly TextBlock _riskBadge;
        private readonly Border _contentBorder;
        private readonly StackPanel _contentPanel;
        private readonly TextBlock _inputLabel;
        private readonly TextBlock _inputText;
        private readonly TextBlock _outputLabel;
        private readonly TextBlock _outputText;
        private readonly TextBlock _permissionsText;
        private readonly StackPanel _reviewPanel;
        private readonly Button _approveButton;
        private readonly Button _rejectButton;
        private readonly TextBlock _verdictText;

        public event Action OnApprove;
        public event Action OnReject;

        public ToolCallDetail()
        {
            _root = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4 };

            // Header
            _header = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8, Padding = new Thickness(8, 4, 8, 4) };
            _toggleButton = new Button { Content = "\u25B6", FontSize = 12, Padding = new Thickness(4) };
            _toggleButton.Click += (s, e) => Send(WidgetEvent.Toggle);
            AutomationProperties.SetName(_toggleButton, "Toggle tool call details");

            _toolName = new TextBlock { Text = "", FontSize = 13, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold, VerticalAlignment = VerticalAlignment.Center };
            _statusBadge = new TextBlock { Text = "", FontSize = 11, VerticalAlignment = VerticalAlignment.Center };
            _riskBadge = new TextBlock { Text = "", FontSize = 11, VerticalAlignment = VerticalAlignment.Center };

            _header.Children.Add(_toggleButton);
            _header.Children.Add(_toolName);
            _header.Children.Add(_riskBadge);
            _header.Children.Add(_statusBadge);
            _root.Children.Add(_header);

            // Content
            _contentBorder = new Border
            {
                Padding = new Thickness(12, 8, 12, 8),
                Visibility = Visibility.Collapsed,
                BorderThickness = new Thickness(2, 0, 0, 0),
                BorderBrush = new SolidColorBrush(Colors.Gray)
            };
            _contentPanel = new StackPanel { Orientation = Orientation.Vertical, Spacing = 8 };

            // Input
            _inputLabel = new TextBlock { Text = "Input", FontSize = 12, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
            _inputText = new TextBlock { Text = "", FontSize = 12, TextWrapping = TextWrapping.Wrap, IsTextSelectionEnabled = true };
            _contentPanel.Children.Add(_inputLabel);
            _contentPanel.Children.Add(_inputText);

            // Output
            _outputLabel = new TextBlock { Text = "Output", FontSize = 12, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
            _outputText = new TextBlock { Text = "", FontSize = 12, TextWrapping = TextWrapping.Wrap, IsTextSelectionEnabled = true };
            _contentPanel.Children.Add(_outputLabel);
            _contentPanel.Children.Add(_outputText);

            // Permissions
            _permissionsText = new TextBlock { Text = "", FontSize = 11, Opacity = 0.7, TextWrapping = TextWrapping.Wrap };
            _contentPanel.Children.Add(_permissionsText);

            // Review panel
            _reviewPanel = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8, Visibility = Visibility.Collapsed };
            _approveButton = new Button { Content = "\u2713 Approve" };
            _approveButton.Click += (s, e) =>
            {
                Send(WidgetEvent.Approve);
                OnApprove?.Invoke();
            };
            AutomationProperties.SetName(_approveButton, "Approve tool call");
            _rejectButton = new Button { Content = "\u2717 Reject" };
            _rejectButton.Click += (s, e) =>
            {
                Send(WidgetEvent.Reject);
                OnReject?.Invoke();
            };
            AutomationProperties.SetName(_rejectButton, "Reject tool call");
            _reviewPanel.Children.Add(_approveButton);
            _reviewPanel.Children.Add(_rejectButton);
            _contentPanel.Children.Add(_reviewPanel);

            // Verdict
            _verdictText = new TextBlock { Text = "", FontSize = 13, FontWeight = Microsoft.UI.Text.FontWeights.Bold, Visibility = Visibility.Collapsed };
            _contentPanel.Children.Add(_verdictText);

            _contentBorder.Child = _contentPanel;
            _root.Children.Add(_contentBorder);

            this.Content = _root;
            AutomationProperties.SetName(this, "Detailed view of a single tool call with safety analysis");
        }

        public void SetToolCall(string name, string input, string output = null, string risk = "low", string[] permissions = null)
        {
            _toolName.Text = name;
            _inputText.Text = input;
            _outputText.Text = output ?? "";

            _riskBadge.Text = $"{risk} risk";
            _riskBadge.Foreground = risk switch
            {
                "high" => new SolidColorBrush(Colors.Red),
                "medium" => new SolidColorBrush(Colors.Orange),
                _ => new SolidColorBrush(Colors.Green)
            };

            _permissionsText.Text = permissions != null ? $"Permissions: {string.Join(", ", permissions)}" : "";
            _permissionsText.Visibility = permissions != null ? Visibility.Visible : Visibility.Collapsed;
        }

        public void RequestReview()
        {
            Send(WidgetEvent.Review);
        }

        public void Send(WidgetEvent evt)
        {
            _state = Reduce(_state, evt);
            UpdateVisuals();
        }

        private void UpdateVisuals()
        {
            bool expanded = _state != WidgetState.Idle;
            _contentBorder.Visibility = expanded ? Visibility.Visible : Visibility.Collapsed;
            _toggleButton.Content = expanded ? "\u25BC" : "\u25B6";
            _reviewPanel.Visibility = _state == WidgetState.Reviewing ? Visibility.Visible : Visibility.Collapsed;

            if (_state == WidgetState.Approved)
            {
                _verdictText.Text = "\u2713 Approved";
                _verdictText.Foreground = new SolidColorBrush(Colors.Green);
                _verdictText.Visibility = Visibility.Visible;
                _statusBadge.Text = "\u2713";
            }
            else if (_state == WidgetState.Rejected)
            {
                _verdictText.Text = "\u2717 Rejected";
                _verdictText.Foreground = new SolidColorBrush(Colors.Red);
                _verdictText.Visibility = Visibility.Visible;
                _statusBadge.Text = "\u2717";
            }
            else
            {
                _verdictText.Visibility = Visibility.Collapsed;
            }
        }

        private WidgetState Reduce(WidgetState state, WidgetEvent evt) => state switch
        {
            WidgetState.Idle when evt == WidgetEvent.Toggle => WidgetState.Expanded,
            WidgetState.Idle when evt == WidgetEvent.Review => WidgetState.Reviewing,
            WidgetState.Expanded when evt == WidgetEvent.Toggle => WidgetState.Idle,
            WidgetState.Expanded when evt == WidgetEvent.Review => WidgetState.Reviewing,
            WidgetState.Reviewing when evt == WidgetEvent.Approve => WidgetState.Approved,
            WidgetState.Reviewing when evt == WidgetEvent.Reject => WidgetState.Rejected,
            WidgetState.Approved when evt == WidgetEvent.Reset => WidgetState.Idle,
            WidgetState.Rejected when evt == WidgetEvent.Reset => WidgetState.Idle,
            _ => state
        };
    }
}
