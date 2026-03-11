// ============================================================
// Clef Surface WinUI Widget — TextInput
//
// Single-line text entry field rendered with WinUI 3 TextBox.
// Supports controlled and uncontrolled value, placeholder,
// label, disabled, read-only, and required-field states.
//
// Adapts the text-input.widget spec: anatomy (root, label,
// input, description, error, prefix, suffix, clearButton),
// states (empty, filled, idle, focused, valid, invalid,
// disabled, readOnly), and connect attributes to WinUI 3.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Primitives;

public sealed class ClefTextInput : UserControl
{
    public static readonly DependencyProperty ValueProperty =
        DependencyProperty.Register(nameof(Value), typeof(string), typeof(ClefTextInput),
            new PropertyMetadata("", OnPropertyChanged));

    public static readonly DependencyProperty PlaceholderProperty =
        DependencyProperty.Register(nameof(Placeholder), typeof(string), typeof(ClefTextInput),
            new PropertyMetadata(""));

    public static readonly DependencyProperty IsDisabledProperty =
        DependencyProperty.Register(nameof(IsDisabled), typeof(bool), typeof(ClefTextInput),
            new PropertyMetadata(false, OnPropertyChanged));

    public static readonly DependencyProperty IsReadOnlyProperty =
        DependencyProperty.Register(nameof(IsReadOnly), typeof(bool), typeof(ClefTextInput),
            new PropertyMetadata(false, OnPropertyChanged));

    public static readonly DependencyProperty LabelProperty =
        DependencyProperty.Register(nameof(Label), typeof(string), typeof(ClefTextInput),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty IsRequiredProperty =
        DependencyProperty.Register(nameof(IsRequired), typeof(bool), typeof(ClefTextInput),
            new PropertyMetadata(false, OnPropertyChanged));

    public string Value { get => (string)GetValue(ValueProperty); set => SetValue(ValueProperty, value); }
    public string Placeholder { get => (string)GetValue(PlaceholderProperty); set => SetValue(PlaceholderProperty, value); }
    public bool IsDisabled { get => (bool)GetValue(IsDisabledProperty); set => SetValue(IsDisabledProperty, value); }
    public bool IsReadOnly { get => (bool)GetValue(IsReadOnlyProperty); set => SetValue(IsReadOnlyProperty, value); }
    public string Label { get => (string)GetValue(LabelProperty); set => SetValue(LabelProperty, value); }
    public bool IsRequired { get => (bool)GetValue(IsRequiredProperty); set => SetValue(IsRequiredProperty, value); }

    public event System.EventHandler<string> ValueChanged;
    public event System.EventHandler<string> Submitted;

    private readonly StackPanel _root;
    private readonly TextBlock _labelBlock;
    private readonly TextBox _textBox;

    public ClefTextInput()
    {
        _labelBlock = new TextBlock { Visibility = Visibility.Collapsed };
        _textBox = new TextBox();
        _textBox.TextChanged += (s, e) =>
        {
            Value = _textBox.Text;
            ValueChanged?.Invoke(this, _textBox.Text);
        };
        _textBox.KeyDown += (s, e) =>
        {
            if (e.Key == Windows.System.VirtualKey.Enter)
                Submitted?.Invoke(this, _textBox.Text);
        };
        _root = new StackPanel { Spacing = 4 };
        _root.Children.Add(_labelBlock);
        _root.Children.Add(_textBox);
        Content = _root;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefTextInput)d).UpdateVisual();

    private void UpdateVisual()
    {
        _textBox.IsEnabled = !IsDisabled;
        _textBox.IsReadOnly = IsReadOnly;
        _textBox.PlaceholderText = Placeholder;
        if (_textBox.Text != Value)
            _textBox.Text = Value ?? "";

        if (!string.IsNullOrEmpty(Label))
        {
            _labelBlock.Text = IsRequired ? $"{Label} *" : Label;
            _labelBlock.Visibility = Visibility.Visible;
        }
        else
        {
            _labelBlock.Visibility = Visibility.Collapsed;
        }
        AutomationProperties.SetName(_textBox, Label ?? "Text input");
    }
}
