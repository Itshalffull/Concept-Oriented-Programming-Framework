// ============================================================
// Clef Surface WinUI Widget — NumberInput
//
// Numeric input with increment/decrement controls. Renders a
// NumberBox with optional +/- buttons. Respects min, max, and
// step constraints. Maps the number-input.widget anatomy
// (root, label, input, incrementButton, decrementButton) to
// WinUI 3 NumberBox.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.FormControls;

public sealed class ClefNumberInput : UserControl
{
    public static readonly DependencyProperty ValueProperty =
        DependencyProperty.Register(nameof(Value), typeof(double), typeof(ClefNumberInput),
            new PropertyMetadata(0.0, OnPropertyChanged));

    public static readonly DependencyProperty MinimumProperty =
        DependencyProperty.Register(nameof(Minimum), typeof(double), typeof(ClefNumberInput),
            new PropertyMetadata(double.MinValue, OnPropertyChanged));

    public static readonly DependencyProperty MaximumProperty =
        DependencyProperty.Register(nameof(Maximum), typeof(double), typeof(ClefNumberInput),
            new PropertyMetadata(double.MaxValue, OnPropertyChanged));

    public static readonly DependencyProperty StepProperty =
        DependencyProperty.Register(nameof(Step), typeof(double), typeof(ClefNumberInput),
            new PropertyMetadata(1.0, OnPropertyChanged));

    public static readonly DependencyProperty LabelProperty =
        DependencyProperty.Register(nameof(Label), typeof(string), typeof(ClefNumberInput),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty IsEnabledOverrideProperty =
        DependencyProperty.Register(nameof(IsEnabledOverride), typeof(bool), typeof(ClefNumberInput),
            new PropertyMetadata(true, OnPropertyChanged));

    public double Value { get => (double)GetValue(ValueProperty); set => SetValue(ValueProperty, value); }
    public double Minimum { get => (double)GetValue(MinimumProperty); set => SetValue(MinimumProperty, value); }
    public double Maximum { get => (double)GetValue(MaximumProperty); set => SetValue(MaximumProperty, value); }
    public double Step { get => (double)GetValue(StepProperty); set => SetValue(StepProperty, value); }
    public string Label { get => (string)GetValue(LabelProperty); set => SetValue(LabelProperty, value); }
    public bool IsEnabledOverride { get => (bool)GetValue(IsEnabledOverrideProperty); set => SetValue(IsEnabledOverrideProperty, value); }

    public event System.EventHandler<double> ValueChanged;

    private readonly StackPanel _root;
    private readonly TextBlock _labelBlock;
    private readonly NumberBox _numberBox;

    public ClefNumberInput()
    {
        _labelBlock = new TextBlock { Visibility = Visibility.Collapsed, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
        _numberBox = new NumberBox
        {
            SpinButtonPlacementMode = NumberBoxSpinButtonPlacementMode.Inline,
            SmallChange = 1
        };
        _numberBox.ValueChanged += (s, e) =>
        {
            if (!double.IsNaN(e.NewValue))
            {
                Value = e.NewValue;
                ValueChanged?.Invoke(this, e.NewValue);
            }
        };
        _root = new StackPanel { Spacing = 4 };
        _root.Children.Add(_labelBlock);
        _root.Children.Add(_numberBox);
        Content = _root;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefNumberInput)d).UpdateVisual();

    private void UpdateVisual()
    {
        _labelBlock.Text = Label ?? "";
        _labelBlock.Visibility = string.IsNullOrEmpty(Label) ? Visibility.Collapsed : Visibility.Visible;
        _numberBox.Minimum = Minimum;
        _numberBox.Maximum = Maximum;
        _numberBox.SmallChange = Step;
        _numberBox.LargeChange = Step * 10;
        _numberBox.Value = Value;
        _numberBox.IsEnabled = IsEnabledOverride;
        AutomationProperties.SetName(_numberBox, Label ?? "Number input");
    }
}
