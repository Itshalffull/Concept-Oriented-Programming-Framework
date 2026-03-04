// ============================================================
// Clef Surface WinUI Widget — ProgressBar
//
// Visual progress indicator. Renders a WinUI 3 ProgressBar
// with an optional label and percentage readout. Maps the
// progress-bar.widget anatomy (root, track, fill, label,
// valueText) to WinUI 3 ProgressBar with TextBlock display.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.FormControls;

public sealed class ClefProgressBar : UserControl
{
    public static readonly DependencyProperty ValueProperty =
        DependencyProperty.Register(nameof(Value), typeof(double), typeof(ClefProgressBar),
            new PropertyMetadata(0.0, OnPropertyChanged));

    public static readonly DependencyProperty MaximumProperty =
        DependencyProperty.Register(nameof(Maximum), typeof(double), typeof(ClefProgressBar),
            new PropertyMetadata(100.0, OnPropertyChanged));

    public static readonly DependencyProperty LabelProperty =
        DependencyProperty.Register(nameof(Label), typeof(string), typeof(ClefProgressBar),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty ShowValueProperty =
        DependencyProperty.Register(nameof(ShowValue), typeof(bool), typeof(ClefProgressBar),
            new PropertyMetadata(true, OnPropertyChanged));

    public double Value { get => (double)GetValue(ValueProperty); set => SetValue(ValueProperty, value); }
    public double Maximum { get => (double)GetValue(MaximumProperty); set => SetValue(MaximumProperty, value); }
    public string Label { get => (string)GetValue(LabelProperty); set => SetValue(LabelProperty, value); }
    public bool ShowValue { get => (bool)GetValue(ShowValueProperty); set => SetValue(ShowValueProperty, value); }

    private readonly StackPanel _root;
    private readonly TextBlock _labelBlock;
    private readonly StackPanel _barRow;
    private readonly ProgressBar _progressBar;
    private readonly TextBlock _valueText;

    public ClefProgressBar()
    {
        _labelBlock = new TextBlock { Visibility = Visibility.Collapsed, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
        _progressBar = new ProgressBar { Minimum = 0, HorizontalAlignment = HorizontalAlignment.Stretch };
        _valueText = new TextBlock { Margin = new Thickness(8, 0, 0, 0) };
        _barRow = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
        _barRow.Children.Add(_progressBar);
        _barRow.Children.Add(_valueText);
        _root = new StackPanel { Spacing = 4 };
        _root.Children.Add(_labelBlock);
        _root.Children.Add(_barRow);
        Content = _root;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefProgressBar)d).UpdateVisual();

    private void UpdateVisual()
    {
        _labelBlock.Text = Label ?? "";
        _labelBlock.Visibility = string.IsNullOrEmpty(Label) ? Visibility.Collapsed : Visibility.Visible;
        _progressBar.Maximum = Maximum;
        var clamped = System.Math.Clamp(Value, 0, Maximum);
        _progressBar.Value = clamped;
        var percent = Maximum > 0 ? (int)(clamped / Maximum * 100) : 0;
        _valueText.Text = $"{percent}%";
        _valueText.Visibility = ShowValue ? Visibility.Visible : Visibility.Collapsed;
        AutomationProperties.SetName(_progressBar, $"Progress: {percent}%");
    }
}
