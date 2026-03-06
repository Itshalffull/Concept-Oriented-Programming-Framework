using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System;
using System.Collections.Generic;

namespace Clef.Surface.Widgets.Concepts.ProcessHuman
{
    public sealed partial class ApprovalStepper : UserControl
    {
        private enum WidgetState { Viewing, StepSelected, Approving, Rejecting }
        private enum WidgetEvent { SelectStep, Deselect, Approve, Reject, Confirm, Cancel }

        private WidgetState _state = WidgetState.Viewing;
        private readonly StackPanel _root;
        private readonly TextBlock _title;
        private readonly StackPanel _stepperPanel;
        private readonly ScrollViewer _scrollViewer;
        private readonly StackPanel _detailPanel;
        private readonly TextBlock _detailStepName;
        private readonly TextBlock _detailAssignee;
        private readonly TextBlock _detailStatus;
        private readonly TextBlock _detailTimestamp;
        private readonly TextBlock _detailNotes;
        private readonly StackPanel _actionPanel;
        private readonly Button _approveButton;
        private readonly Button _rejectButton;
        private readonly TextBox _notesInput;
        private readonly Button _confirmButton;
        private readonly Button _cancelButton;
        private readonly Button _closeDetailButton;
        private int _selectedStep = -1;

        public event Action<int, string> OnApprove;
        public event Action<int, string> OnReject;

        public ApprovalStepper()
        {
            _root = new StackPanel { Orientation = Orientation.Vertical, Spacing = 8, Padding = new Thickness(12) };

            // Header
            _title = new TextBlock { Text = "Approval Flow", FontSize = 16, FontWeight = Microsoft.UI.Text.FontWeights.Bold };
            _root.Children.Add(_title);

            // Stepper
            _stepperPanel = new StackPanel { Orientation = Orientation.Vertical, Spacing = 0 };
            _scrollViewer = new ScrollViewer { Content = _stepperPanel, MaxHeight = 400 };
            _root.Children.Add(_scrollViewer);

            // Detail panel (hidden)
            _detailPanel = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4, Visibility = Visibility.Collapsed, Padding = new Thickness(8) };
            var detailHeader = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            _detailStepName = new TextBlock { Text = "", FontSize = 14, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
            _closeDetailButton = new Button { Content = "\u2715", FontSize = 11 };
            _closeDetailButton.Click += (s, e) => Send(WidgetEvent.Deselect);
            AutomationProperties.SetName(_closeDetailButton, "Close step detail");
            detailHeader.Children.Add(_detailStepName);
            detailHeader.Children.Add(_closeDetailButton);
            _detailAssignee = new TextBlock { Text = "", FontSize = 12, Opacity = 0.7 };
            _detailStatus = new TextBlock { Text = "", FontSize = 12 };
            _detailTimestamp = new TextBlock { Text = "", FontSize = 11, Opacity = 0.6 };
            _detailNotes = new TextBlock { Text = "", FontSize = 12, TextWrapping = TextWrapping.Wrap, Opacity = 0.8 };
            _detailPanel.Children.Add(detailHeader);
            _detailPanel.Children.Add(_detailAssignee);
            _detailPanel.Children.Add(_detailStatus);
            _detailPanel.Children.Add(_detailTimestamp);
            _detailPanel.Children.Add(_detailNotes);

            // Action buttons
            _actionPanel = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4, Visibility = Visibility.Collapsed };
            var actionButtons = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            _approveButton = new Button { Content = "\u2713 Approve" };
            _approveButton.Click += (s, e) => Send(WidgetEvent.Approve);
            AutomationProperties.SetName(_approveButton, "Approve step");
            _rejectButton = new Button { Content = "\u2717 Reject" };
            _rejectButton.Click += (s, e) => Send(WidgetEvent.Reject);
            AutomationProperties.SetName(_rejectButton, "Reject step");
            actionButtons.Children.Add(_approveButton);
            actionButtons.Children.Add(_rejectButton);
            _actionPanel.Children.Add(actionButtons);

            _notesInput = new TextBox { PlaceholderText = "Add notes (optional)...", AcceptsReturn = true, Visibility = Visibility.Collapsed };
            AutomationProperties.SetName(_notesInput, "Approval notes");
            _actionPanel.Children.Add(_notesInput);

            var confirmButtons = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4, Visibility = Visibility.Collapsed };
            _confirmButton = new Button { Content = "Confirm" };
            _confirmButton.Click += (s, e) =>
            {
                Send(WidgetEvent.Confirm);
            };
            _cancelButton = new Button { Content = "Cancel" };
            _cancelButton.Click += (s, e) => Send(WidgetEvent.Cancel);
            confirmButtons.Children.Add(_confirmButton);
            confirmButtons.Children.Add(_cancelButton);
            _actionPanel.Children.Add(confirmButtons);

            _detailPanel.Children.Add(_actionPanel);
            _root.Children.Add(_detailPanel);

            this.Content = _root;
            AutomationProperties.SetName(this, "Multi-step approval flow visualization showing step status and actions");
        }

        public void AddStep(string name, string assignee, string status = "pending", string timestamp = null, string notes = null)
        {
            string statusIcon = status switch
            {
                "approved" => "\u2713",
                "rejected" => "\u2717",
                "current" => "\u25CF",
                "skipped" => "\u2014",
                _ => "\u25CB"
            };

            var statusColor = status switch
            {
                "approved" => Colors.Green,
                "rejected" => Colors.Red,
                "current" => Colors.DodgerBlue,
                _ => Colors.Gray
            };

            var stepPanel = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8, Padding = new Thickness(8, 6, 8, 6) };
            var connector = new Border { Width = 2, Height = 20, Background = new SolidColorBrush(Colors.Gray), Margin = new Thickness(8, 0, 0, 0) };
            var icon = new TextBlock { Text = statusIcon, FontSize = 14, Foreground = new SolidColorBrush(statusColor), VerticalAlignment = VerticalAlignment.Center };
            var nameText = new TextBlock { Text = name, FontSize = 13, VerticalAlignment = VerticalAlignment.Center };
            var assigneeText = new TextBlock { Text = assignee, FontSize = 11, Opacity = 0.6, VerticalAlignment = VerticalAlignment.Center };

            if (status == "current")
            {
                nameText.FontWeight = Microsoft.UI.Text.FontWeights.Bold;
            }

            stepPanel.Children.Add(icon);
            stepPanel.Children.Add(nameText);
            stepPanel.Children.Add(assigneeText);

            if (timestamp != null)
            {
                stepPanel.Children.Add(new TextBlock { Text = timestamp, FontSize = 10, Opacity = 0.5, VerticalAlignment = VerticalAlignment.Center });
            }

            int index = _stepperPanel.Children.Count / 2; // account for connectors
            stepPanel.PointerPressed += (s, e) =>
            {
                _selectedStep = index;
                _detailStepName.Text = name;
                _detailAssignee.Text = $"Assignee: {assignee}";
                _detailStatus.Text = $"Status: {status}";
                _detailStatus.Foreground = new SolidColorBrush(statusColor);
                _detailTimestamp.Text = timestamp ?? "";
                _detailNotes.Text = notes ?? "";
                _actionPanel.Visibility = status == "current" ? Visibility.Visible : Visibility.Collapsed;
                Send(WidgetEvent.SelectStep);
            };

            AutomationProperties.SetName(stepPanel, $"Step: {name} - {status} - {assignee}");

            if (_stepperPanel.Children.Count > 0)
            {
                _stepperPanel.Children.Add(connector);
            }
            _stepperPanel.Children.Add(stepPanel);
        }

        public void Send(WidgetEvent evt)
        {
            _state = Reduce(_state, evt);
            UpdateVisuals();

            if (evt == WidgetEvent.Confirm && _selectedStep >= 0)
            {
                if (_state == WidgetState.Viewing)
                {
                    // Was approving or rejecting, now confirmed
                }
            }
        }

        private void UpdateVisuals()
        {
            _detailPanel.Visibility = _state != WidgetState.Viewing ? Visibility.Visible : Visibility.Collapsed;
            bool showNotes = _state == WidgetState.Approving || _state == WidgetState.Rejecting;
            _notesInput.Visibility = showNotes ? Visibility.Visible : Visibility.Collapsed;

            // Show confirm/cancel only when approving or rejecting
            if (_actionPanel.Children.Count > 2 && _actionPanel.Children[2] is StackPanel confirmBtns)
            {
                confirmBtns.Visibility = showNotes ? Visibility.Visible : Visibility.Collapsed;
            }
        }

        private WidgetState Reduce(WidgetState state, WidgetEvent evt) => state switch
        {
            WidgetState.Viewing when evt == WidgetEvent.SelectStep => WidgetState.StepSelected,
            WidgetState.StepSelected when evt == WidgetEvent.Deselect => WidgetState.Viewing,
            WidgetState.StepSelected when evt == WidgetEvent.SelectStep => WidgetState.StepSelected,
            WidgetState.StepSelected when evt == WidgetEvent.Approve => WidgetState.Approving,
            WidgetState.StepSelected when evt == WidgetEvent.Reject => WidgetState.Rejecting,
            WidgetState.Approving when evt == WidgetEvent.Confirm => WidgetState.Viewing,
            WidgetState.Approving when evt == WidgetEvent.Cancel => WidgetState.StepSelected,
            WidgetState.Rejecting when evt == WidgetEvent.Confirm => WidgetState.Viewing,
            WidgetState.Rejecting when evt == WidgetEvent.Cancel => WidgetState.StepSelected,
            _ => state
        };
    }
}
