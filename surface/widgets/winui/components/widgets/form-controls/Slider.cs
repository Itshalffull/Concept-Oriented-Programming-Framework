// ============================================================
// Clef Surface WinUI Widget — Slider
//
// Range input slider. Renders a WinUI 3 Slider with an
// optional label and value readout. Maps the slider.widget
// anatomy (root, label, track, range, thumb, output) to
// WinUI 3 Slider with TextBlock display.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.FormControls;

public sealed class ClefSlider : UserControl
{
    public static readonly DependencyProperty ValueProperty =
        DependencyProperty.Register(nameof(Value), typeof(double), typeof(ClefSlider),
            new PropertyMetadata(0.0, OnPropertyChanged));

    public static readonly DependencyProperty MinimumProperty =
        DependencyProperty.Register(nameof(Minimum), typeof(double), typeof(ClefSlider),
            new PropertyMetadata(0.0, OnPropertyChanged));

    public static readonly DependencyProperty MaximumProperty =
        DependencyProperty.Register(nameof(Maximum), typeof(double), typeof(ClefSlider),
            new PropertyMetadata(100.0, OnPropertyChanged));

    public static readonly DependencyProperty LabelProperty =
        DependencyProperty.Register(nameof(Label), typeof(string), typeof(ClefSlider),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty ShowValueProperty =
        DependencyProperty.Register(nameof(ShowValue), typeof(bool), typeof(ClefSlider),
            new PropertyMetadata(true, OnPropertyChanged));

    public static readonly DependencyProperty IsEnabledOverrideProperty =
        DependencyProperty.Register(nameof(IsEnabledOverride), typeof(bool), typeof(ClefSlider),
            new PropertyMetadata(true, OnPropertyChanged));

    public double Value { get => (double)GetValue(ValueProperty); set => SetValue(ValueProperty, value); }
    public double Minimum { get => (double)GetValue(MinimumProperty); set => SetValue(MinimumProperty, value); }
    public double Maximum { get => (double)GetValue(MaximumProperty); set => SetValue(MaximumProperty, value); }
    public string Label { get => (string)GetValue(LabelProperty); set => SetValue(LabelProperty, value); }
    public bool ShowValue { get => (bool)GetValue(ShowValueProperty); set => SetValue(ShowValueProperty, value); }
    public bool IsEnabledOverride { get => (bool)GetValue(IsEnabledOverrideProperty); set => SetValue(IsEnabledOverrideProperty, value); }

    public event System.EventHandler<double> ValueChanged;

    private readonly StackPanel _root;
    private readonly TextBlock _labelBlock;
    private readonly Slider _slider;
    private readonly TextBlock _valueText;

    public ClefSlider()
    {
        _labelBlock = new TextBlock { Visibility = Visibility.Collapsed, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
        _slider = new Slider { HorizontalAlignment = HorizontalAlignment.Stretch };
        _slider.ValueChanged += (s, e) => { Value = e.NewValue; ValueChanged?.Invoke(this, e.NewValue); UpdatePercent(); };
        _valueText = new TextBlock { Margin = new Thickness(8, 0, 0, 0) };
        var row = new StackPanel { Orientation = Orientation.Horizontal };
        row.Children.Add(_slider);
        row.Children.Add(_valueText);
        _root = new StackPanel { Spacing = 4 };
        _root.Children.Add(_labelBlock);
        _root.Children.Add(row);
        Content = _root;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefSlider)d).UpdateVisual();

    private void UpdatePercent()
    {
        var ratio = Maximum > Minimum ? (Value - Minimum) / (Maximum - Minimum) : 0;
        _valueText.Text = $"{(int)(ratio * 100)}%";
    }

    private void UpdateVisual()
    {
        _labelBlock.Text = Label ?? "";
        _labelBlock.Visibility = string.IsNullOrEmpty(Label) ? Visibility.Collapsed : Visibility.Visible;
        _slider.Minimum = Minimum;
        _slider.Maximum = Maximum;
        _slider.Value = Value;
        _slider.IsEnabled = IsEnabledOverride;
        _valueText.Visibility = ShowValue ? Visibility.Visible : Visibility.Collapsed;
        UpdatePercent();
        AutomationProperties.SetName(_slider, Label ?? "Slider");
    }
}
