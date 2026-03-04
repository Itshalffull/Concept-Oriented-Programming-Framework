// ============================================================
// Clef Surface WinUI Widget — RangeSlider
//
// Dual-thumb slider for selecting a range of values. Maps the
// rangeslider.widget spec to WinUI 3 paired Slider controls.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.ComplexInputs;

public sealed class ClefRangeSlider : UserControl
{
    public static readonly DependencyProperty MinValueProperty =
        DependencyProperty.Register(nameof(MinValue), typeof(double), typeof(ClefRangeSlider),
            new PropertyMetadata(0.0, OnPropertyChanged));

    public static readonly DependencyProperty MaxValueProperty =
        DependencyProperty.Register(nameof(MaxValue), typeof(double), typeof(ClefRangeSlider),
            new PropertyMetadata(100.0, OnPropertyChanged));

    public static readonly DependencyProperty LowValueProperty =
        DependencyProperty.Register(nameof(LowValue), typeof(double), typeof(ClefRangeSlider),
            new PropertyMetadata(20.0, OnPropertyChanged));

    public static readonly DependencyProperty HighValueProperty =
        DependencyProperty.Register(nameof(HighValue), typeof(double), typeof(ClefRangeSlider),
            new PropertyMetadata(80.0, OnPropertyChanged));

    public double MinValue { get => (double)GetValue(MinValueProperty); set => SetValue(MinValueProperty, value); }
    public double MaxValue { get => (double)GetValue(MaxValueProperty); set => SetValue(MaxValueProperty, value); }
    public double LowValue { get => (double)GetValue(LowValueProperty); set => SetValue(LowValueProperty, value); }
    public double HighValue { get => (double)GetValue(HighValueProperty); set => SetValue(HighValueProperty, value); }

    public event System.EventHandler<(double Low, double High)> RangeChanged;

    private readonly StackPanel _root;
    private readonly Slider _lowSlider;
    private readonly Slider _highSlider;
    private readonly TextBlock _rangeText;

    public ClefRangeSlider()
    {
        _lowSlider = new Slider { HorizontalAlignment = HorizontalAlignment.Stretch };
        _lowSlider.ValueChanged += (s, e) =>
        {
            LowValue = e.NewValue;
            if (LowValue > HighValue) LowValue = HighValue;
            RangeChanged?.Invoke(this, (LowValue, HighValue));
            UpdateDisplay();
        };
        _highSlider = new Slider { HorizontalAlignment = HorizontalAlignment.Stretch };
        _highSlider.ValueChanged += (s, e) =>
        {
            HighValue = e.NewValue;
            if (HighValue < LowValue) HighValue = LowValue;
            RangeChanged?.Invoke(this, (LowValue, HighValue));
            UpdateDisplay();
        };
        _rangeText = new TextBlock { HorizontalAlignment = HorizontalAlignment.Center };
        _root = new StackPanel { Spacing = 4 };
        _root.Children.Add(_lowSlider);
        _root.Children.Add(_highSlider);
        _root.Children.Add(_rangeText);
        Content = _root;
        UpdateVisual();
    }

    private void UpdateDisplay() => _rangeText.Text = $"{LowValue:F0} - {HighValue:F0}";

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefRangeSlider)d).UpdateVisual();

    private void UpdateVisual()
    {
        _lowSlider.Minimum = MinValue;
        _lowSlider.Maximum = MaxValue;
        _lowSlider.Value = LowValue;
        _highSlider.Minimum = MinValue;
        _highSlider.Maximum = MaxValue;
        _highSlider.Value = HighValue;
        UpdateDisplay();
    }
}
