using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System;

namespace Clef.Surface.Widgets.Concepts.LlmAgent
{
    public sealed partial class HitlInterrupt : UserControl
    {
        private enum WidgetState { Pending, Editing, Approving, Rejecting, Forking, Resolved }
        private enum WidgetEvent { Edit, Approve, Reject, Fork, Confirm, Cancel, Reset }

        private WidgetState _state = WidgetState.Pending;
        private readonly StackPanel _root;
        private readonly Border _riskBadge;
        private readonly TextBlock _riskText;
        private readonly TextBlock _actionText;
        private readonly TextBlock _reasonText;
        private readonly TextBlock _countdownText;
        private readonly StackPanel _contextPanel;
        private readonly Button _contextToggle;
        private readonly TextBlock _contextContent;
        private readonly StackPanel _buttonBar;
        private readonly Button _approveButton;
        private readonly Button _denyButton;
        private readonly Button _editButton;
        private readonly Button _forkButton;
        private readonly TextBox _editInput;
        private readonly StackPanel _editPanel;
        private readonly Button _confirmButton;
        private readonly Button _cancelButton;
        private readonly TextBlock _resolvedBanner;
        private readonly DispatcherTimer _timer;
        private int _remainingSeconds = 30;
        private bool _contextExpanded = false;

        public event Action OnApprove;
        public event Action OnDeny;
        public event Action<string> OnEdit;
        public event Action OnFork;

        public HitlInterrupt()
        {
            _root = new StackPanel { Orientation = Orientation.Vertical, Spacing = 8, Padding = new Thickness(12) };

            // Risk badge
            _riskBadge = new Border
            {
                Background = new SolidColorBrush(Colors.Orange),
                CornerRadius = new CornerRadius(4),
                Padding = new Thickness(8, 4, 8, 4)
            };
            _riskText = new TextBlock { Text = "Medium Risk", FontSize = 12, FontWeight = Microsoft.UI.Text.FontWeights.Bold };
            _riskBadge.Child = _riskText;
            _root.Children.Add(_riskBadge);

            // Action description
            _actionText = new TextBlock { Text = "Tool call requires approval", FontSize = 14, TextWrapping = TextWrapping.Wrap };
            _root.Children.Add(_actionText);

            // Reason
            _reasonText = new TextBlock { Text = "", FontSize = 12, Opacity = 0.8, TextWrapping = TextWrapping.Wrap };
            _root.Children.Add(_reasonText);

            // Countdown
            _countdownText = new TextBlock { Text = "Auto-deny in 30s", FontSize = 12, Opacity = 0.7 };
            AutomationProperties.SetLiveSetting(_countdownText, AutomationLiveSetting.Polite);
            _root.Children.Add(_countdownText);

            // Context toggle
            _contextPanel = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4 };
            _contextToggle = new Button { Content = "\u25B6 Show Context", FontSize = 12 };
            _contextToggle.Click += (s, e) =>
            {
                _contextExpanded = !_contextExpanded;
                _contextContent.Visibility = _contextExpanded ? Visibility.Visible : Visibility.Collapsed;
                _contextToggle.Content = _contextExpanded ? "\u25BC Hide Context" : "\u25B6 Show Context";
            };
            _contextContent = new TextBlock { Text = "", TextWrapping = TextWrapping.Wrap, Visibility = Visibility.Collapsed, FontSize = 12 };
            _contextPanel.Children.Add(_contextToggle);
            _contextPanel.Children.Add(_contextContent);
            _root.Children.Add(_contextPanel);

            // Action buttons
            _buttonBar = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            _approveButton = new Button { Content = "\u2713 Approve" };
            _approveButton.Click += (s, e) => Send(WidgetEvent.Approve);
            AutomationProperties.SetName(_approveButton, "Approve action");

            _denyButton = new Button { Content = "\u2717 Deny" };
            _denyButton.Click += (s, e) => Send(WidgetEvent.Reject);
            AutomationProperties.SetName(_denyButton, "Deny action");

            _editButton = new Button { Content = "\u270E Edit" };
            _editButton.Click += (s, e) => Send(WidgetEvent.Edit);
            AutomationProperties.SetName(_editButton, "Edit action parameters");

            _forkButton = new Button { Content = "\u2442 Fork" };
            _forkButton.Click += (s, e) => Send(WidgetEvent.Fork);
            AutomationProperties.SetName(_forkButton, "Fork execution");

            _buttonBar.Children.Add(_approveButton);
            _buttonBar.Children.Add(_denyButton);
            _buttonBar.Children.Add(_editButton);
            _buttonBar.Children.Add(_forkButton);
            _root.Children.Add(_buttonBar);

            // Edit panel (hidden by default)
            _editPanel = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4, Visibility = Visibility.Collapsed };
            _editInput = new TextBox { PlaceholderText = "Modified parameters...", AcceptsReturn = true };
            AutomationProperties.SetName(_editInput, "Edit action parameters");
            var editButtons = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            _confirmButton = new Button { Content = "Confirm" };
            _confirmButton.Click += (s, e) => Send(WidgetEvent.Confirm);
            _cancelButton = new Button { Content = "Cancel" };
            _cancelButton.Click += (s, e) => Send(WidgetEvent.Cancel);
            editButtons.Children.Add(_confirmButton);
            editButtons.Children.Add(_cancelButton);
            _editPanel.Children.Add(_editInput);
            _editPanel.Children.Add(editButtons);
            _root.Children.Add(_editPanel);

            // Resolved banner
            _resolvedBanner = new TextBlock
            {
                Text = "Action resolved",
                Visibility = Visibility.Collapsed,
                FontSize = 14,
                FontWeight = Microsoft.UI.Text.FontWeights.Bold
            };
            _root.Children.Add(_resolvedBanner);

            // Timer for auto-deny countdown
            _timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1) };
            _timer.Tick += (s, e) =>
            {
                _remainingSeconds--;
                _countdownText.Text = $"Auto-deny in {_remainingSeconds}s";
                if (_remainingSeconds <= 0)
                {
                    _timer.Stop();
                    Send(WidgetEvent.Reject);
                }
            };
            _timer.Start();

            this.Content = _root;
            AutomationProperties.SetName(this, "Human-in-the-loop interrupt banner for action approval");
        }

        public void SetAction(string action, string reason, string risk = "medium")
        {
            _actionText.Text = action;
            _reasonText.Text = reason;
            _riskText.Text = $"{char.ToUpper(risk[0])}{risk.Substring(1)} Risk";
            _riskBadge.Background = risk switch
            {
                "high" => new SolidColorBrush(Colors.Red),
                "low" => new SolidColorBrush(Colors.Green),
                _ => new SolidColorBrush(Colors.Orange)
            };
        }

        public void SetContext(string context) => _contextContent.Text = context;

        public void SetCountdown(int seconds)
        {
            _remainingSeconds = seconds;
            _countdownText.Text = $"Auto-deny in {seconds}s";
        }

        public void Send(WidgetEvent evt)
        {
            _state = Reduce(_state, evt);
            UpdateVisuals();

            if (_state == WidgetState.Resolved)
            {
                _timer.Stop();
                if (evt == WidgetEvent.Approve) OnApprove?.Invoke();
                else if (evt == WidgetEvent.Reject) OnDeny?.Invoke();
                else if (evt == WidgetEvent.Confirm) OnEdit?.Invoke(_editInput.Text);
                else if (evt == WidgetEvent.Fork) OnFork?.Invoke();
            }
        }

        private void UpdateVisuals()
        {
            _buttonBar.Visibility = _state == WidgetState.Pending ? Visibility.Visible : Visibility.Collapsed;
            _editPanel.Visibility = _state == WidgetState.Editing ? Visibility.Visible : Visibility.Collapsed;
            _countdownText.Visibility = _state == WidgetState.Pending ? Visibility.Visible : Visibility.Collapsed;
            _resolvedBanner.Visibility = _state == WidgetState.Resolved ? Visibility.Visible : Visibility.Collapsed;
        }

        private WidgetState Reduce(WidgetState state, WidgetEvent evt) => state switch
        {
            WidgetState.Pending when evt == WidgetEvent.Approve => WidgetState.Resolved,
            WidgetState.Pending when evt == WidgetEvent.Reject => WidgetState.Resolved,
            WidgetState.Pending when evt == WidgetEvent.Edit => WidgetState.Editing,
            WidgetState.Pending when evt == WidgetEvent.Fork => WidgetState.Resolved,
            WidgetState.Editing when evt == WidgetEvent.Confirm => WidgetState.Resolved,
            WidgetState.Editing when evt == WidgetEvent.Cancel => WidgetState.Pending,
            _ => state
        };
    }
}
