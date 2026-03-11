using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System;

namespace Clef.Surface.Widgets.Concepts.ProcessAutomation
{
    public sealed partial class ExpressionToggleInput : UserControl
    {
        private enum WidgetState { Fixed, Expression, Validating, Error }
        private enum WidgetEvent { ToggleMode, Input, Validate, ValidateSuccess, ValidateFail, Clear }

        private WidgetState _state = WidgetState.Fixed;
        private readonly StackPanel _root;
        private readonly StackPanel _header;
        private readonly TextBlock _label;
        private readonly ToggleSwitch _modeToggle;
        private readonly TextBox _fixedInput;
        private readonly TextBox _expressionInput;
        private readonly TextBlock _expressionHint;
        private readonly ProgressRing _validatingRing;
        private readonly TextBlock _errorText;
        private readonly TextBlock _validBadge;

        public event Action<string> OnValueChange;
        public event Action<string> OnExpressionChange;

        public ExpressionToggleInput()
        {
            _root = new StackPanel { Orientation = Orientation.Vertical, Spacing = 6, Padding = new Thickness(8) };

            // Header
            _header = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            _label = new TextBlock { Text = "Value", FontSize = 13, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold, VerticalAlignment = VerticalAlignment.Center };
            _modeToggle = new ToggleSwitch { Header = "", OffContent = "Fixed", OnContent = "Expression", IsOn = false };
            _modeToggle.Toggled += (s, e) => Send(WidgetEvent.ToggleMode);
            AutomationProperties.SetName(_modeToggle, "Toggle between fixed value and expression mode");
            _header.Children.Add(_label);
            _header.Children.Add(_modeToggle);
            _root.Children.Add(_header);

            // Fixed value input
            _fixedInput = new TextBox { PlaceholderText = "Enter value..." };
            AutomationProperties.SetName(_fixedInput, "Fixed value");
            _fixedInput.TextChanged += (s, e) =>
            {
                Send(WidgetEvent.Input);
                OnValueChange?.Invoke(_fixedInput.Text);
            };
            _root.Children.Add(_fixedInput);

            // Expression input (hidden)
            _expressionInput = new TextBox
            {
                PlaceholderText = "Enter expression... e.g. ${steps.prev.output}",
                Visibility = Visibility.Collapsed,
                AcceptsReturn = false
            };
            AutomationProperties.SetName(_expressionInput, "Expression input");
            _expressionInput.TextChanged += (s, e) =>
            {
                Send(WidgetEvent.Input);
                OnExpressionChange?.Invoke(_expressionInput.Text);
            };
            _expressionInput.LostFocus += (s, e) =>
            {
                if (_state == WidgetState.Expression && !string.IsNullOrEmpty(_expressionInput.Text))
                    Send(WidgetEvent.Validate);
            };
            _root.Children.Add(_expressionInput);

            // Expression hint
            _expressionHint = new TextBlock
            {
                Text = "Use ${...} syntax to reference variables",
                FontSize = 11,
                Opacity = 0.5,
                Visibility = Visibility.Collapsed
            };
            _root.Children.Add(_expressionHint);

            // Validation indicator
            var validationRow = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            _validatingRing = new ProgressRing { IsActive = false, Width = 12, Height = 12, Visibility = Visibility.Collapsed };
            _validBadge = new TextBlock { Text = "\u2713 Valid", FontSize = 11, Foreground = new SolidColorBrush(Colors.Green), Visibility = Visibility.Collapsed };
            _errorText = new TextBlock { Text = "", FontSize = 11, Foreground = new SolidColorBrush(Colors.Red), Visibility = Visibility.Collapsed, TextWrapping = TextWrapping.Wrap };
            validationRow.Children.Add(_validatingRing);
            validationRow.Children.Add(_validBadge);
            validationRow.Children.Add(_errorText);
            _root.Children.Add(validationRow);

            this.Content = _root;
            AutomationProperties.SetName(this, "Dual-mode input field that switches between fixed value and expression");
        }

        public void SetLabel(string label) => _label.Text = label;
        public void SetValue(string value) => _fixedInput.Text = value;
        public void SetExpression(string expression) => _expressionInput.Text = expression;

        public void SetValidationResult(bool valid, string error = null)
        {
            if (valid)
                Send(WidgetEvent.ValidateSuccess);
            else
            {
                _errorText.Text = error ?? "Invalid expression";
                Send(WidgetEvent.ValidateFail);
            }
        }

        public void Send(WidgetEvent evt)
        {
            _state = Reduce(_state, evt);
            UpdateVisuals();
        }

        private void UpdateVisuals()
        {
            bool isExpression = _state == WidgetState.Expression || _state == WidgetState.Validating || _state == WidgetState.Error;
            _fixedInput.Visibility = !isExpression ? Visibility.Visible : Visibility.Collapsed;
            _expressionInput.Visibility = isExpression ? Visibility.Visible : Visibility.Collapsed;
            _expressionHint.Visibility = isExpression ? Visibility.Visible : Visibility.Collapsed;
            _modeToggle.IsOn = isExpression;
            _validatingRing.IsActive = _state == WidgetState.Validating;
            _validatingRing.Visibility = _state == WidgetState.Validating ? Visibility.Visible : Visibility.Collapsed;
            _validBadge.Visibility = _state == WidgetState.Expression && !string.IsNullOrEmpty(_expressionInput.Text) ? Visibility.Visible : Visibility.Collapsed;
            _errorText.Visibility = _state == WidgetState.Error ? Visibility.Visible : Visibility.Collapsed;
        }

        private WidgetState Reduce(WidgetState state, WidgetEvent evt) => state switch
        {
            WidgetState.Fixed when evt == WidgetEvent.ToggleMode => WidgetState.Expression,
            WidgetState.Fixed when evt == WidgetEvent.Input => WidgetState.Fixed,
            WidgetState.Expression when evt == WidgetEvent.ToggleMode => WidgetState.Fixed,
            WidgetState.Expression when evt == WidgetEvent.Input => WidgetState.Expression,
            WidgetState.Expression when evt == WidgetEvent.Validate => WidgetState.Validating,
            WidgetState.Validating when evt == WidgetEvent.ValidateSuccess => WidgetState.Expression,
            WidgetState.Validating when evt == WidgetEvent.ValidateFail => WidgetState.Error,
            WidgetState.Error when evt == WidgetEvent.Input => WidgetState.Expression,
            WidgetState.Error when evt == WidgetEvent.ToggleMode => WidgetState.Fixed,
            _ => state
        };
    }
}
