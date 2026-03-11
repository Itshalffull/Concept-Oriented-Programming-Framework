// ============================================================
// Clef Surface WinUI Widget — Gauge
//
// Radial or linear gauge displaying a value within a range.
// Maps the gauge.widget spec to WinUI 3 ProgressRing with
// custom value display.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.DataDisplay;

public sealed class ClefGauge : UserControl
{
    public static readonly DependencyProperty ValueProperty =
        DependencyProperty.Register(nameof(Value), typeof(double), typeof(ClefGauge),
            new PropertyMetadata(0.0, OnPropertyChanged));

    public static readonly DependencyProperty MinimumProperty =
        DependencyProperty.Register(nameof(Minimum), typeof(double), typeof(ClefGauge),
            new PropertyMetadata(0.0, OnPropertyChanged));

    public static readonly DependencyProperty MaximumProperty =
        DependencyProperty.Register(nameof(Maximum), typeof(double), typeof(ClefGauge),
            new PropertyMetadata(100.0, OnPropertyChanged));

    public static readonly DependencyProperty LabelProperty =
        DependencyProperty.Register(nameof(Label), typeof(string), typeof(ClefGauge),
            new PropertyMetadata(null, OnPropertyChanged));

    public double Value { get => (double)GetValue(ValueProperty); set => SetValue(ValueProperty, value); }
    public double Minimum { get => (double)GetValue(MinimumProperty); set => SetValue(MinimumProperty, value); }
    public double Maximum { get => (double)GetValue(MaximumProperty); set => SetValue(MaximumProperty, value); }
    public string Label { get => (string)GetValue(LabelProperty); set => SetValue(LabelProperty, value); }

    private readonly Grid _root;
    private readonly ProgressRing _ring;
    private readonly TextBlock _valueText;
    private readonly TextBlock _labelBlock;

    public ClefGauge()
    {
        _ring = new ProgressRing { IsIndeterminate = false, Width = 80, Height = 80 };
        _valueText = new TextBlock
        {
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center,
            FontSize = 18,
            FontWeight = Microsoft.UI.Text.FontWeights.Bold
        };
        _labelBlock = new TextBlock
        {
            HorizontalAlignment = HorizontalAlignment.Center,
            Opacity = 0.7,
            Visibility = Visibility.Collapsed
        };
        _root = new Grid();
        _root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        _root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        var overlay = new Grid();
        overlay.Children.Add(_ring);
        overlay.Children.Add(_valueText);
        Grid.SetRow(overlay, 0);
        Grid.SetRow(_labelBlock, 1);
        _root.Children.Add(overlay);
        _root.Children.Add(_labelBlock);
        Content = _root;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefGauge)d).UpdateVisual();

    private void UpdateVisual()
    {
        double range = Maximum - Minimum;
        double pct = range > 0 ? (Value - Minimum) / range * 100 : 0;
        _ring.Value = pct;
        _valueText.Text = $"{(int)pct}%";
        _labelBlock.Text = Label ?? "";
        _labelBlock.Visibility = string.IsNullOrEmpty(Label) ? Visibility.Collapsed : Visibility.Visible;
    }
}
