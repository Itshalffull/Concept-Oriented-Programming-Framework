using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Input;
using System;

namespace Clef.Surface.Widgets.Concepts.LlmConversation
{
    public sealed partial class PromptInput : UserControl
    {
        private enum WidgetState { Empty, Composing, Submitting, Disabled }
        private enum WidgetEvent { Input, Clear, Submit, SubmitComplete, Disable, Enable }

        private WidgetState _state = WidgetState.Empty;
        private readonly StackPanel _root;
        private readonly Grid _inputRow;
        private readonly TextBox _textInput;
        private readonly Button _submitButton;
        private readonly StackPanel _toolbar;
        private readonly Button _attachButton;
        private readonly TextBlock _charCount;
        private readonly TextBlock _modelLabel;
        private readonly ProgressRing _submittingRing;
        private int _maxLength = 4000;

        public event Action<string> OnSubmit;
        public event Action OnAttach;

        public PromptInput()
        {
            _root = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4, Padding = new Thickness(8) };

            // Input row
            _inputRow = new Grid();
            _inputRow.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            _inputRow.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            _textInput = new TextBox
            {
                PlaceholderText = "Type a message...",
                AcceptsReturn = true,
                TextWrapping = TextWrapping.Wrap,
                MaxHeight = 150
            };
            AutomationProperties.SetName(_textInput, "Message input");
            _textInput.TextChanged += (s, e) =>
            {
                if (string.IsNullOrEmpty(_textInput.Text))
                    Send(WidgetEvent.Clear);
                else
                    Send(WidgetEvent.Input);
                UpdateCharCount();
            };
            _textInput.KeyDown += (s, e) =>
            {
                if (e.Key == Windows.System.VirtualKey.Enter && !e.KeyStatus.IsKeyReleased)
                {
                    var ctrl = Microsoft.UI.Input.InputKeyboardSource.GetKeyStateForCurrentThread(Windows.System.VirtualKey.Control);
                    if (ctrl.HasFlag(Windows.UI.Core.CoreVirtualKeyStates.Down))
                    {
                        // Ctrl+Enter: newline (default)
                    }
                    else if (_state == WidgetState.Composing)
                    {
                        e.Handled = true;
                        HandleSubmit();
                    }
                }
            };
            Grid.SetColumn(_textInput, 0);
            _inputRow.Children.Add(_textInput);

            var submitPanel = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4, VerticalAlignment = VerticalAlignment.Bottom };
            _submitButton = new Button { Content = "\u2191 Send", IsEnabled = false };
            _submitButton.Click += (s, e) => HandleSubmit();
            AutomationProperties.SetName(_submitButton, "Send message");
            _submittingRing = new ProgressRing { IsActive = false, Width = 16, Height = 16, Visibility = Visibility.Collapsed };
            submitPanel.Children.Add(_submittingRing);
            submitPanel.Children.Add(_submitButton);
            Grid.SetColumn(submitPanel, 1);
            _inputRow.Children.Add(submitPanel);
            _root.Children.Add(_inputRow);

            // Toolbar
            _toolbar = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            _attachButton = new Button { Content = "\u2795 Attach", FontSize = 11 };
            _attachButton.Click += (s, e) => OnAttach?.Invoke();
            AutomationProperties.SetName(_attachButton, "Attach file");
            _charCount = new TextBlock { Text = $"0 / {_maxLength}", FontSize = 11, Opacity = 0.6, VerticalAlignment = VerticalAlignment.Center };
            _modelLabel = new TextBlock { Text = "", FontSize = 11, Opacity = 0.5, VerticalAlignment = VerticalAlignment.Center };
            _toolbar.Children.Add(_attachButton);
            _toolbar.Children.Add(_charCount);
            _toolbar.Children.Add(_modelLabel);
            _root.Children.Add(_toolbar);

            this.Content = _root;
            AutomationProperties.SetName(this, "Auto-expanding textarea for composing LLM prompts");
        }

        public void SetModel(string model) => _modelLabel.Text = model;
        public void SetMaxLength(int max) { _maxLength = max; UpdateCharCount(); }

        private void UpdateCharCount()
        {
            int len = _textInput.Text?.Length ?? 0;
            _charCount.Text = $"{len} / {_maxLength}";
        }

        private void HandleSubmit()
        {
            if (_state != WidgetState.Composing) return;
            string text = _textInput.Text;
            Send(WidgetEvent.Submit);
            OnSubmit?.Invoke(text);
        }

        public void CompleteSubmit()
        {
            _textInput.Text = "";
            Send(WidgetEvent.SubmitComplete);
        }

        public void SetDisabled(bool disabled)
        {
            Send(disabled ? WidgetEvent.Disable : WidgetEvent.Enable);
        }

        public void Send(WidgetEvent evt)
        {
            _state = Reduce(_state, evt);
            UpdateVisuals();
        }

        private void UpdateVisuals()
        {
            _submitButton.IsEnabled = _state == WidgetState.Composing;
            _textInput.IsEnabled = _state != WidgetState.Submitting && _state != WidgetState.Disabled;
            _submittingRing.IsActive = _state == WidgetState.Submitting;
            _submittingRing.Visibility = _state == WidgetState.Submitting ? Visibility.Visible : Visibility.Collapsed;
        }

        private WidgetState Reduce(WidgetState state, WidgetEvent evt) => state switch
        {
            WidgetState.Empty when evt == WidgetEvent.Input => WidgetState.Composing,
            WidgetState.Composing when evt == WidgetEvent.Clear => WidgetState.Empty,
            WidgetState.Composing when evt == WidgetEvent.Input => WidgetState.Composing,
            WidgetState.Composing when evt == WidgetEvent.Submit => WidgetState.Submitting,
            WidgetState.Composing when evt == WidgetEvent.Disable => WidgetState.Disabled,
            WidgetState.Submitting when evt == WidgetEvent.SubmitComplete => WidgetState.Empty,
            WidgetState.Disabled when evt == WidgetEvent.Enable => WidgetState.Empty,
            _ => state
        };
    }
}
