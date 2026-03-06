using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace Clef.Surface.Widgets.Concepts.LlmPrompt
{
    public sealed partial class PromptTemplateEditor : UserControl
    {
        private enum WidgetState { Editing, Testing, Viewing }
        private enum WidgetEvent { Test, Input, TestComplete, TestError, Edit }

        private WidgetState _state = WidgetState.Editing;
        private readonly StackPanel _root;
        private readonly TextBlock _title;
        private readonly TextBox _systemPrompt;
        private readonly TextBox _userPrompt;
        private readonly StackPanel _messageList;
        private readonly Button _addMessageButton;
        private readonly StackPanel _variablePanel;
        private readonly TextBlock _modelLabel;
        private readonly TextBlock _tokenCount;
        private readonly Button _testButton;
        private readonly StackPanel _testPanel;
        private readonly TextBlock _testResult;
        private readonly TextBlock _testError;
        private readonly Button _editButton;
        private readonly StackPanel _toolList;
        private readonly ScrollViewer _scrollViewer;

        public event Action OnTest;
        public event Action<string> OnSystemPromptChange;
        public event Action<string> OnUserPromptChange;

        public PromptTemplateEditor()
        {
            _root = new StackPanel { Orientation = Orientation.Vertical, Spacing = 8, Padding = new Thickness(12) };

            // Title
            _title = new TextBlock { Text = "Prompt Template Editor", FontSize = 16, FontWeight = Microsoft.UI.Text.FontWeights.Bold };
            _root.Children.Add(_title);

            // System prompt
            var systemLabel = new TextBlock { Text = "System", FontSize = 12, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
            _root.Children.Add(systemLabel);
            _systemPrompt = new TextBox
            {
                PlaceholderText = "System instructions...",
                AcceptsReturn = true,
                TextWrapping = TextWrapping.Wrap,
                MinHeight = 60
            };
            AutomationProperties.SetName(_systemPrompt, "System prompt");
            _systemPrompt.TextChanged += (s, e) =>
            {
                Send(WidgetEvent.Input);
                UpdateTokenCount();
                UpdateVariables();
                OnSystemPromptChange?.Invoke(_systemPrompt.Text);
            };
            _root.Children.Add(_systemPrompt);

            // User prompt
            var userLabel = new TextBlock { Text = "User", FontSize = 12, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
            _root.Children.Add(userLabel);
            _userPrompt = new TextBox
            {
                PlaceholderText = "User prompt template...",
                AcceptsReturn = true,
                TextWrapping = TextWrapping.Wrap,
                MinHeight = 100
            };
            AutomationProperties.SetName(_userPrompt, "User prompt");
            _userPrompt.TextChanged += (s, e) =>
            {
                Send(WidgetEvent.Input);
                UpdateTokenCount();
                UpdateVariables();
                OnUserPromptChange?.Invoke(_userPrompt.Text);
            };
            _root.Children.Add(_userPrompt);

            // Additional messages
            _messageList = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4 };
            _root.Children.Add(_messageList);

            _addMessageButton = new Button { Content = "+ Add Message" };
            _addMessageButton.Click += (s, e) => AddMessageBlock("user", "");
            AutomationProperties.SetName(_addMessageButton, "Add message");
            _root.Children.Add(_addMessageButton);

            // Variables
            _variablePanel = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            _root.Children.Add(_variablePanel);

            // Model badge
            _modelLabel = new TextBlock { Text = "", FontSize = 11, Opacity = 0.6 };
            _root.Children.Add(_modelLabel);

            // Token count
            _tokenCount = new TextBlock { Text = "~0 tokens", FontSize = 11, Opacity = 0.6 };
            AutomationProperties.SetLiveSetting(_tokenCount, AutomationLiveSetting.Polite);
            _root.Children.Add(_tokenCount);

            // Test button
            _testButton = new Button { Content = "Test Prompt" };
            _testButton.Click += (s, e) =>
            {
                Send(WidgetEvent.Test);
                OnTest?.Invoke();
            };
            AutomationProperties.SetName(_testButton, "Test prompt");
            _root.Children.Add(_testButton);

            // Test panel (hidden)
            _testPanel = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4, Visibility = Visibility.Collapsed };
            var testHeader = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            testHeader.Children.Add(new TextBlock { Text = "Test Result", FontSize = 13, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold });
            _editButton = new Button { Content = "Edit" };
            _editButton.Click += (s, e) => Send(WidgetEvent.Edit);
            AutomationProperties.SetName(_editButton, "Back to editing");
            testHeader.Children.Add(_editButton);
            _testPanel.Children.Add(testHeader);
            _testResult = new TextBlock { Text = "", FontSize = 12, TextWrapping = TextWrapping.Wrap, IsTextSelectionEnabled = true };
            _testPanel.Children.Add(_testResult);
            _testError = new TextBlock { Text = "", FontSize = 12, Foreground = new SolidColorBrush(Colors.Red), Visibility = Visibility.Collapsed, TextWrapping = TextWrapping.Wrap };
            _testPanel.Children.Add(_testError);
            _root.Children.Add(_testPanel);

            // Tool list
            _toolList = new StackPanel { Orientation = Orientation.Vertical, Spacing = 2, Visibility = Visibility.Collapsed };
            _root.Children.Add(_toolList);

            _scrollViewer = new ScrollViewer { Content = _root, MaxHeight = 600 };
            this.Content = _scrollViewer;
            AutomationProperties.SetName(this, "Multi-message prompt template editor with variable detection and testing");
        }

        public void SetModel(string model) => _modelLabel.Text = model;

        public void SetSystemPrompt(string text) => _systemPrompt.Text = text;
        public void SetUserPrompt(string text) => _userPrompt.Text = text;

        public void SetTestResult(string result)
        {
            _testResult.Text = result;
            Send(WidgetEvent.TestComplete);
        }

        public void SetTestError(string error)
        {
            _testError.Text = error;
            _testError.Visibility = Visibility.Visible;
            Send(WidgetEvent.TestError);
        }

        public void AddTool(string name, string description = null)
        {
            _toolList.Visibility = Visibility.Visible;
            if (_toolList.Children.Count == 0)
            {
                _toolList.Children.Add(new TextBlock { Text = "Tools", FontSize = 12, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold });
            }
            var toolItem = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            toolItem.Children.Add(new TextBlock { Text = name, FontSize = 12, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold });
            if (description != null)
                toolItem.Children.Add(new TextBlock { Text = description, FontSize = 11, Opacity = 0.6 });
            _toolList.Children.Add(toolItem);
        }

        private void AddMessageBlock(string role, string content)
        {
            var block = new StackPanel { Orientation = Orientation.Vertical, Spacing = 2 };
            var header = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };

            var roleCombo = new ComboBox { FontSize = 12, Width = 100 };
            roleCombo.Items.Add("System");
            roleCombo.Items.Add("User");
            roleCombo.Items.Add("Assistant");
            roleCombo.SelectedItem = char.ToUpper(role[0]) + role.Substring(1);

            var removeBtn = new Button { Content = "\u2715", FontSize = 10 };
            removeBtn.Click += (s, e) => _messageList.Children.Remove(block);
            AutomationProperties.SetName(removeBtn, "Remove message");

            header.Children.Add(roleCombo);
            header.Children.Add(removeBtn);

            var textBox = new TextBox { Text = content, AcceptsReturn = true, TextWrapping = TextWrapping.Wrap, MinHeight = 40 };
            textBox.TextChanged += (s, e) => { UpdateTokenCount(); UpdateVariables(); };

            block.Children.Add(header);
            block.Children.Add(textBox);
            _messageList.Children.Add(block);
        }

        private void UpdateTokenCount()
        {
            string allText = (_systemPrompt.Text ?? "") + (_userPrompt.Text ?? "");
            int tokens = (int)Math.Ceiling(allText.Length / 4.0);
            _tokenCount.Text = $"~{tokens} tokens";
        }

        private void UpdateVariables()
        {
            _variablePanel.Children.Clear();
            string allText = (_systemPrompt.Text ?? "") + (_userPrompt.Text ?? "");
            var matches = Regex.Matches(allText, @"\{\{(\w+)\}\}");
            var seen = new HashSet<string>();
            foreach (Match match in matches)
            {
                string varName = match.Groups[1].Value;
                if (seen.Add(varName))
                {
                    var pill = new Border
                    {
                        CornerRadius = new CornerRadius(8),
                        Padding = new Thickness(6, 2, 6, 2),
                        Background = new SolidColorBrush(Colors.LightGray)
                    };
                    pill.Child = new TextBlock { Text = $"{{{{{varName}}}}}", FontSize = 11 };
                    AutomationProperties.SetName(pill, $"Variable: {varName}");
                    _variablePanel.Children.Add(pill);
                }
            }
            if (_variablePanel.Children.Count == 0)
            {
                _variablePanel.Children.Add(new TextBlock { Text = "No template variables detected", FontSize = 11, Opacity = 0.5 });
            }
        }

        public void Send(WidgetEvent evt)
        {
            _state = Reduce(_state, evt);
            UpdateVisuals();
        }

        private void UpdateVisuals()
        {
            bool editing = _state == WidgetState.Editing;
            _systemPrompt.IsEnabled = editing;
            _userPrompt.IsEnabled = editing;
            _addMessageButton.IsEnabled = editing;
            _testButton.Content = _state == WidgetState.Testing ? "Testing..." : "Test Prompt";
            _testButton.IsEnabled = _state != WidgetState.Testing;
            _testPanel.Visibility = _state == WidgetState.Viewing ? Visibility.Visible : Visibility.Collapsed;
        }

        private WidgetState Reduce(WidgetState state, WidgetEvent evt) => state switch
        {
            WidgetState.Editing when evt == WidgetEvent.Test => WidgetState.Testing,
            WidgetState.Editing when evt == WidgetEvent.Input => WidgetState.Editing,
            WidgetState.Testing when evt == WidgetEvent.TestComplete => WidgetState.Viewing,
            WidgetState.Testing when evt == WidgetEvent.TestError => WidgetState.Editing,
            WidgetState.Viewing when evt == WidgetEvent.Edit => WidgetState.Editing,
            WidgetState.Viewing when evt == WidgetEvent.Test => WidgetState.Testing,
            _ => state
        };
    }
}
