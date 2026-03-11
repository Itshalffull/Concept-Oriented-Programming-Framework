// ============================================================
// Clef Surface WinUI Widget — Stepper
//
// Compact increment/decrement control. Renders as a Row with
// [-] value [+] buttons flanking the current value. Respects
// min, max, and step constraints. Maps the stepper.widget
// anatomy to WinUI 3 Button + TextBlock layout.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.FormControls;

public sealed class ClefStepper : UserControl
{
    public static readonly DependencyProperty ValueProperty =
        DependencyProperty.Register(nameof(Value), typeof(int), typeof(ClefStepper),
            new PropertyMetadata(0, OnPropertyChanged));

    public static readonly DependencyProperty MinimumProperty =
        DependencyProperty.Register(nameof(Minimum), typeof(int), typeof(ClefStepper),
            new PropertyMetadata(0, OnPropertyChanged));

    public static readonly DependencyProperty MaximumProperty =
        DependencyProperty.Register(nameof(Maximum), typeof(int), typeof(ClefStepper),
            new PropertyMetadata(10, OnPropertyChanged));

    public static readonly DependencyProperty StepProperty =
        DependencyProperty.Register(nameof(Step), typeof(int), typeof(ClefStepper),
            new PropertyMetadata(1));

    public static readonly DependencyProperty LabelProperty =
        DependencyProperty.Register(nameof(Label), typeof(string), typeof(ClefStepper),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty IsEnabledOverrideProperty =
        DependencyProperty.Register(nameof(IsEnabledOverride), typeof(bool), typeof(ClefStepper),
            new PropertyMetadata(true, OnPropertyChanged));

    public int Value { get => (int)GetValue(ValueProperty); set => SetValue(ValueProperty, value); }
    public int Minimum { get => (int)GetValue(MinimumProperty); set => SetValue(MinimumProperty, value); }
    public int Maximum { get => (int)GetValue(MaximumProperty); set => SetValue(MaximumProperty, value); }
    public int Step { get => (int)GetValue(StepProperty); set => SetValue(StepProperty, value); }
    public string Label { get => (string)GetValue(LabelProperty); set => SetValue(LabelProperty, value); }
    public bool IsEnabledOverride { get => (bool)GetValue(IsEnabledOverrideProperty); set => SetValue(IsEnabledOverrideProperty, value); }

    public event System.EventHandler<int> ValueChanged;

    private readonly StackPanel _root;
    private readonly TextBlock _labelBlock;
    private readonly Button _decrementBtn;
    private readonly TextBlock _valueText;
    private readonly Button _incrementBtn;

    public ClefStepper()
    {
        _labelBlock = new TextBlock { Visibility = Visibility.Collapsed, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
        _decrementBtn = new Button { Content = new SymbolIcon(Symbol.Remove) };
        _decrementBtn.Click += (s, e) => { var next = System.Math.Clamp(Value - Step, Minimum, Maximum); if (next != Value) { Value = next; ValueChanged?.Invoke(this, next); } };
        _valueText = new TextBlock { FontWeight = Microsoft.UI.Text.FontWeights.Bold, Margin = new Thickness(16, 0, 16, 0), VerticalAlignment = VerticalAlignment.Center };
        _incrementBtn = new Button { Content = new SymbolIcon(Symbol.Add) };
        _incrementBtn.Click += (s, e) => { var next = System.Math.Clamp(Value + Step, Minimum, Maximum); if (next != Value) { Value = next; ValueChanged?.Invoke(this, next); } };
        var row = new StackPanel { Orientation = Orientation.Horizontal };
        row.Children.Add(_decrementBtn);
        row.Children.Add(_valueText);
        row.Children.Add(_incrementBtn);
        _root = new StackPanel { Spacing = 4 };
        _root.Children.Add(_labelBlock);
        _root.Children.Add(row);
        Content = _root;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefStepper)d).UpdateVisual();

    private void UpdateVisual()
    {
        _labelBlock.Text = Label ?? "";
        _labelBlock.Visibility = string.IsNullOrEmpty(Label) ? Visibility.Collapsed : Visibility.Visible;
        _valueText.Text = Value.ToString();
        _decrementBtn.IsEnabled = IsEnabledOverride && Value > Minimum;
        _incrementBtn.IsEnabled = IsEnabledOverride && Value < Maximum;
        _valueText.Opacity = IsEnabledOverride ? 1.0 : 0.38;
    }
}
