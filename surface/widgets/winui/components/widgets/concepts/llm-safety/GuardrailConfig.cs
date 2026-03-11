using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System;

namespace Clef.Surface.Widgets.Concepts.LlmSafety
{
    public sealed partial class GuardrailConfig : UserControl
    {
        private enum WidgetState { Viewing, Editing, Testing, Saving }
        private enum WidgetEvent { Edit, Save, Cancel, Test, TestComplete, TestFail, SaveComplete }

        private WidgetState _state = WidgetState.Viewing;
        private readonly StackPanel _root;
        private readonly TextBlock _title;
        private readonly StackPanel _ruleList;
        private readonly ScrollViewer _scrollViewer;
        private readonly StackPanel _editPanel;
        private readonly TextBox _ruleNameInput;
        private readonly ComboBox _ruleTypeCombo;
        private readonly TextBox _ruleValueInput;
        private readonly ToggleSwitch _ruleEnabledToggle;
        private readonly StackPanel _editButtons;
        private readonly StackPanel _testPanel;
        private readonly TextBlock _testResult;
        private readonly ProgressRing _testRing;
        private readonly Button _addRuleButton;
        private readonly Button _editButton;
        private readonly Button _testButton;

        public event Action OnSave;
        public event Action OnTest;

        public GuardrailConfig()
        {
            _root = new StackPanel { Orientation = Orientation.Vertical, Spacing = 8, Padding = new Thickness(12) };

            // Header
            var header = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            _title = new TextBlock { Text = "Guardrail Configuration", FontSize = 16, FontWeight = Microsoft.UI.Text.FontWeights.Bold, VerticalAlignment = VerticalAlignment.Center };
            _editButton = new Button { Content = "\u270E Edit" };
            _editButton.Click += (s, e) => Send(WidgetEvent.Edit);
            AutomationProperties.SetName(_editButton, "Edit guardrails");
            _testButton = new Button { Content = "Test" };
            _testButton.Click += (s, e) =>
            {
                Send(WidgetEvent.Test);
                OnTest?.Invoke();
            };
            AutomationProperties.SetName(_testButton, "Test guardrails");
            header.Children.Add(_title);
            header.Children.Add(_editButton);
            header.Children.Add(_testButton);
            _root.Children.Add(header);

            // Rule list
            _ruleList = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4 };
            _scrollViewer = new ScrollViewer { Content = _ruleList, MaxHeight = 400 };
            _root.Children.Add(_scrollViewer);

            // Add rule button
            _addRuleButton = new Button { Content = "+ Add Rule", Visibility = Visibility.Collapsed };
            _addRuleButton.Click += (s, e) =>
            {
                _ruleNameInput.Text = "";
                _ruleValueInput.Text = "";
                _ruleEnabledToggle.IsOn = true;
                _editPanel.Visibility = Visibility.Visible;
            };
            AutomationProperties.SetName(_addRuleButton, "Add guardrail rule");
            _root.Children.Add(_addRuleButton);

            // Edit panel (hidden)
            _editPanel = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4, Visibility = Visibility.Collapsed };
            _ruleNameInput = new TextBox { PlaceholderText = "Rule name" };
            AutomationProperties.SetName(_ruleNameInput, "Rule name");
            _ruleTypeCombo = new ComboBox { Width = 150 };
            _ruleTypeCombo.Items.Add("content-filter");
            _ruleTypeCombo.Items.Add("token-limit");
            _ruleTypeCombo.Items.Add("topic-block");
            _ruleTypeCombo.Items.Add("pii-filter");
            _ruleTypeCombo.Items.Add("rate-limit");
            _ruleTypeCombo.SelectedIndex = 0;
            AutomationProperties.SetName(_ruleTypeCombo, "Rule type");
            _ruleValueInput = new TextBox { PlaceholderText = "Rule value or pattern" };
            AutomationProperties.SetName(_ruleValueInput, "Rule value");
            _ruleEnabledToggle = new ToggleSwitch { Header = "Enabled", IsOn = true };

            _editButtons = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            var saveBtn = new Button { Content = "Save" };
            saveBtn.Click += (s, e) =>
            {
                Send(WidgetEvent.Save);
                OnSave?.Invoke();
            };
            var cancelBtn = new Button { Content = "Cancel" };
            cancelBtn.Click += (s, e) => Send(WidgetEvent.Cancel);
            _editButtons.Children.Add(saveBtn);
            _editButtons.Children.Add(cancelBtn);

            _editPanel.Children.Add(_ruleNameInput);
            _editPanel.Children.Add(_ruleTypeCombo);
            _editPanel.Children.Add(_ruleValueInput);
            _editPanel.Children.Add(_ruleEnabledToggle);
            _editPanel.Children.Add(_editButtons);
            _root.Children.Add(_editPanel);

            // Test panel (hidden)
            _testPanel = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4, Visibility = Visibility.Collapsed };
            _testRing = new ProgressRing { IsActive = false, Width = 16, Height = 16, Visibility = Visibility.Collapsed };
            _testResult = new TextBlock { Text = "", FontSize = 12, TextWrapping = TextWrapping.Wrap };
            _testPanel.Children.Add(_testRing);
            _testPanel.Children.Add(_testResult);
            _root.Children.Add(_testPanel);

            this.Content = _root;
            AutomationProperties.SetName(this, "Configuration panel for safety guardrail rules and policies");
        }

        public void AddRule(string name, string type, string value, bool enabled = true)
        {
            var rule = new Border { Padding = new Thickness(8), CornerRadius = new CornerRadius(4), BorderThickness = new Thickness(1), BorderBrush = new SolidColorBrush(Colors.Gray) };
            var ruleContent = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };

            var statusDot = new TextBlock
            {
                Text = "\u25CF",
                FontSize = 10,
                Foreground = new SolidColorBrush(enabled ? Colors.Green : Colors.Gray),
                VerticalAlignment = VerticalAlignment.Center
            };
            var nameText = new TextBlock { Text = name, FontSize = 13, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold, VerticalAlignment = VerticalAlignment.Center };
            var typeText = new TextBlock { Text = type, FontSize = 11, Opacity = 0.6, VerticalAlignment = VerticalAlignment.Center };
            var valueText = new TextBlock { Text = value, FontSize = 11, Opacity = 0.7, VerticalAlignment = VerticalAlignment.Center };

            ruleContent.Children.Add(statusDot);
            ruleContent.Children.Add(nameText);
            ruleContent.Children.Add(typeText);
            ruleContent.Children.Add(valueText);

            rule.Child = ruleContent;
            AutomationProperties.SetName(rule, $"Rule: {name} ({type}) - {(enabled ? "enabled" : "disabled")}");
            _ruleList.Children.Add(rule);
        }

        public void SetTestResult(string result)
        {
            _testResult.Text = result;
            Send(WidgetEvent.TestComplete);
        }

        public void SetTestError(string error)
        {
            _testResult.Text = error;
            _testResult.Foreground = new SolidColorBrush(Colors.Red);
            Send(WidgetEvent.TestFail);
        }

        public void Send(WidgetEvent evt)
        {
            _state = Reduce(_state, evt);
            UpdateVisuals();
        }

        private void UpdateVisuals()
        {
            _editPanel.Visibility = _state == WidgetState.Editing ? Visibility.Visible : Visibility.Collapsed;
            _addRuleButton.Visibility = _state == WidgetState.Editing ? Visibility.Visible : Visibility.Collapsed;
            _editButton.Visibility = _state == WidgetState.Viewing ? Visibility.Visible : Visibility.Collapsed;
            _testPanel.Visibility = _state == WidgetState.Testing ? Visibility.Visible : Visibility.Collapsed;
            _testRing.IsActive = _state == WidgetState.Testing;
            _testRing.Visibility = _state == WidgetState.Testing ? Visibility.Visible : Visibility.Collapsed;
        }

        private WidgetState Reduce(WidgetState state, WidgetEvent evt) => state switch
        {
            WidgetState.Viewing when evt == WidgetEvent.Edit => WidgetState.Editing,
            WidgetState.Viewing when evt == WidgetEvent.Test => WidgetState.Testing,
            WidgetState.Editing when evt == WidgetEvent.Save => WidgetState.Viewing,
            WidgetState.Editing when evt == WidgetEvent.Cancel => WidgetState.Viewing,
            WidgetState.Testing when evt == WidgetEvent.TestComplete => WidgetState.Viewing,
            WidgetState.Testing when evt == WidgetEvent.TestFail => WidgetState.Viewing,
            _ => state
        };
    }
}
