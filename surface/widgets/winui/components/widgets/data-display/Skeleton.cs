// ============================================================
// Clef Surface WinUI Widget — Skeleton
//
// Loading placeholder that mimics the shape of content. Shows
// animated shimmer while data loads. Maps the skeleton.widget
// spec to WinUI 3 Border with shimmer animation.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;

namespace Clef.Surface.WinUI.Widgets.DataDisplay;

public sealed class ClefSkeleton : UserControl
{
    public static readonly DependencyProperty VariantProperty =
        DependencyProperty.Register(nameof(Variant), typeof(string), typeof(ClefSkeleton),
            new PropertyMetadata("rectangle", OnPropertyChanged));

    public static readonly DependencyProperty WidthOverrideProperty =
        DependencyProperty.Register(nameof(WidthOverride), typeof(double), typeof(ClefSkeleton),
            new PropertyMetadata(200.0, OnPropertyChanged));

    public static readonly DependencyProperty HeightOverrideProperty =
        DependencyProperty.Register(nameof(HeightOverride), typeof(double), typeof(ClefSkeleton),
            new PropertyMetadata(20.0, OnPropertyChanged));

    public string Variant { get => (string)GetValue(VariantProperty); set => SetValue(VariantProperty, value); }
    public double WidthOverride { get => (double)GetValue(WidthOverrideProperty); set => SetValue(WidthOverrideProperty, value); }
    public double HeightOverride { get => (double)GetValue(HeightOverrideProperty); set => SetValue(HeightOverrideProperty, value); }

    private readonly Border _border;

    public ClefSkeleton()
    {
        _border = new Border
        {
            Background = new SolidColorBrush(Colors.LightGray),
            Opacity = 0.6
        };
        Content = _border;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefSkeleton)d).UpdateVisual();

    private void UpdateVisual()
    {
        _border.Width = WidthOverride;
        _border.Height = HeightOverride;
        _border.CornerRadius = Variant switch
        {
            "circle" => new CornerRadius(HeightOverride / 2),
            "text" => new CornerRadius(4),
            _ => new CornerRadius(4)
        };
    }
}
