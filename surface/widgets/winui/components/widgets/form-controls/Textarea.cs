// ============================================================
// Clef Surface WinUI Widget — Textarea
//
// Multi-line text input area. Renders a WinUI 3 TextBox
// configured for multiple lines with optional character count.
// Maps the textarea.widget anatomy (root, label, textarea,
// charCount) to WinUI 3 TextBox with AcceptsReturn.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.FormControls;

public sealed class ClefTextarea : UserControl
{
    public static readonly DependencyProperty ValueProperty =
        DependencyProperty.Register(nameof(Value), typeof(string), typeof(ClefTextarea),
            new PropertyMetadata("", OnPropertyChanged));

    public static readonly DependencyProperty PlaceholderProperty =
        DependencyProperty.Register(nameof(Placeholder), typeof(string), typeof(ClefTextarea),
            new PropertyMetadata(""));

    public static readonly DependencyProperty LabelProperty =
        DependencyProperty.Register(nameof(Label), typeof(string), typeof(ClefTextarea),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty MaxLengthProperty =
        DependencyProperty.Register(nameof(MaxLength), typeof(int), typeof(ClefTextarea),
            new PropertyMetadata(0, OnPropertyChanged));

    public static readonly DependencyProperty IsEnabledOverrideProperty =
        DependencyProperty.Register(nameof(IsEnabledOverride), typeof(bool), typeof(ClefTextarea),
            new PropertyMetadata(true, OnPropertyChanged));

    public string Value { get => (string)GetValue(ValueProperty); set => SetValue(ValueProperty, value); }
    public string Placeholder { get => (string)GetValue(PlaceholderProperty); set => SetValue(PlaceholderProperty, value); }
    public string Label { get => (string)GetValue(LabelProperty); set => SetValue(LabelProperty, value); }
    public int MaxLength { get => (int)GetValue(MaxLengthProperty); set => SetValue(MaxLengthProperty, value); }
    public bool IsEnabledOverride { get => (bool)GetValue(IsEnabledOverrideProperty); set => SetValue(IsEnabledOverrideProperty, value); }

    public event System.EventHandler<string> ValueChanged;

    private readonly StackPanel _root;
    private readonly TextBlock _labelBlock;
    private readonly TextBox _textBox;
    private readonly TextBlock _charCount;

    public ClefTextarea()
    {
        _labelBlock = new TextBlock { Visibility = Visibility.Collapsed, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
        _textBox = new TextBox
        {
            AcceptsReturn = true,
            TextWrapping = TextWrapping.Wrap,
            MinHeight = 80,
            HorizontalAlignment = HorizontalAlignment.Stretch
        };
        _textBox.TextChanged += (s, e) =>
        {
            if (MaxLength > 0 && _textBox.Text.Length > MaxLength)
            {
                _textBox.Text = _textBox.Text[..MaxLength];
                _textBox.SelectionStart = MaxLength;
            }
            Value = _textBox.Text;
            ValueChanged?.Invoke(this, _textBox.Text);
            UpdateCharCount();
        };
        _charCount = new TextBlock { Opacity = 0.6, HorizontalAlignment = HorizontalAlignment.Right, Visibility = Visibility.Collapsed };
        _root = new StackPanel { Spacing = 4 };
        _root.Children.Add(_labelBlock);
        _root.Children.Add(_textBox);
        _root.Children.Add(_charCount);
        Content = _root;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefTextarea)d).UpdateVisual();

    private void UpdateCharCount()
    {
        if (MaxLength > 0)
        {
            _charCount.Text = $"{(_textBox.Text?.Length ?? 0)} / {MaxLength}";
            _charCount.Visibility = Visibility.Visible;
        }
        else
        {
            _charCount.Visibility = Visibility.Collapsed;
        }
    }

    private void UpdateVisual()
    {
        _labelBlock.Text = Label ?? "";
        _labelBlock.Visibility = string.IsNullOrEmpty(Label) ? Visibility.Collapsed : Visibility.Visible;
        _textBox.PlaceholderText = Placeholder;
        _textBox.IsEnabled = IsEnabledOverride;
        if (_textBox.Text != Value) _textBox.Text = Value ?? "";
        if (MaxLength > 0) _textBox.MaxLength = MaxLength;
        UpdateCharCount();
        AutomationProperties.SetName(_textBox, Label ?? "Text area");
    }
}
