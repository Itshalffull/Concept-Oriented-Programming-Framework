// ============================================================
// Clef Surface WinUI Widget — StatCard
//
// Summary card displaying a key metric with label, value,
// trend indicator, and optional sparkline. Maps the
// statcard.widget spec to WinUI 3 Border with StackPanel.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.DataDisplay;

public sealed class ClefStatCard : UserControl
{
    public static readonly DependencyProperty LabelProperty =
        DependencyProperty.Register(nameof(Label), typeof(string), typeof(ClefStatCard),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty ValueProperty =
        DependencyProperty.Register(nameof(Value), typeof(string), typeof(ClefStatCard),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty TrendProperty =
        DependencyProperty.Register(nameof(Trend), typeof(string), typeof(ClefStatCard),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty TrendDirectionProperty =
        DependencyProperty.Register(nameof(TrendDirection), typeof(string), typeof(ClefStatCard),
            new PropertyMetadata("neutral", OnPropertyChanged));

    public string Label { get => (string)GetValue(LabelProperty); set => SetValue(LabelProperty, value); }
    public string Value { get => (string)GetValue(ValueProperty); set => SetValue(ValueProperty, value); }
    public string Trend { get => (string)GetValue(TrendProperty); set => SetValue(TrendProperty, value); }
    public string TrendDirection { get => (string)GetValue(TrendDirectionProperty); set => SetValue(TrendDirectionProperty, value); }

    private readonly Border _border;
    private readonly TextBlock _labelBlock;
    private readonly TextBlock _valueBlock;
    private readonly TextBlock _trendBlock;

    public ClefStatCard()
    {
        _labelBlock = new TextBlock { Opacity = 0.7, FontSize = 12 };
        _valueBlock = new TextBlock
        {
            FontSize = 28,
            FontWeight = Microsoft.UI.Text.FontWeights.Bold
        };
        _trendBlock = new TextBlock { FontSize = 12, Visibility = Visibility.Collapsed };
        var stack = new StackPanel { Spacing = 4 };
        stack.Children.Add(_labelBlock);
        stack.Children.Add(_valueBlock);
        stack.Children.Add(_trendBlock);
        _border = new Border
        {
            BorderThickness = new Thickness(1),
            BorderBrush = new Microsoft.UI.Xaml.Media.SolidColorBrush(Microsoft.UI.Colors.LightGray),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(16),
            Child = stack
        };
        Content = _border;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefStatCard)d).UpdateVisual();

    private void UpdateVisual()
    {
        _labelBlock.Text = Label ?? "";
        _valueBlock.Text = Value ?? "";
        _trendBlock.Text = Trend ?? "";
        _trendBlock.Visibility = string.IsNullOrEmpty(Trend) ? Visibility.Collapsed : Visibility.Visible;
        _trendBlock.Foreground = new Microsoft.UI.Xaml.Media.SolidColorBrush(TrendDirection switch
        {
            "up" => Microsoft.UI.Colors.Green,
            "down" => Microsoft.UI.Colors.Red,
            _ => Microsoft.UI.Colors.Gray
        });
    }
}
