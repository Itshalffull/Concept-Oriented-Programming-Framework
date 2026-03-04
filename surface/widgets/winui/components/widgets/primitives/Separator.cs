// ============================================================
// Clef Surface WinUI Widget — Separator
//
// Visual divider that separates content sections. Renders as
// a horizontal or vertical thin line using a Border element.
// Supports custom color and thickness.
//
// Adapts the separator.widget spec: anatomy (root), states
// (static), and connect attributes (role, aria-orientation,
// data-part, data-orientation) to WinUI 3 rendering.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;

namespace Clef.Surface.WinUI.Widgets.Primitives;

public sealed class ClefSeparator : UserControl
{
    public static readonly DependencyProperty OrientationProperty =
        DependencyProperty.Register(nameof(Orientation), typeof(string), typeof(ClefSeparator),
            new PropertyMetadata("horizontal", OnPropertyChanged));

    public static readonly DependencyProperty ThicknessValueProperty =
        DependencyProperty.Register(nameof(ThicknessValue), typeof(double), typeof(ClefSeparator),
            new PropertyMetadata(1.0, OnPropertyChanged));

    public string Orientation { get => (string)GetValue(OrientationProperty); set => SetValue(OrientationProperty, value); }
    public double ThicknessValue { get => (double)GetValue(ThicknessValueProperty); set => SetValue(ThicknessValueProperty, value); }

    private readonly Border _line;

    public ClefSeparator()
    {
        _line = new Border
        {
            Background = new SolidColorBrush(Colors.Gray)
        };
        Content = _line;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefSeparator)d).UpdateVisual();

    private void UpdateVisual()
    {
        if (Orientation == "vertical")
        {
            _line.Width = ThicknessValue;
            _line.Height = double.NaN;
            _line.HorizontalAlignment = HorizontalAlignment.Center;
            _line.VerticalAlignment = VerticalAlignment.Stretch;
        }
        else
        {
            _line.Height = ThicknessValue;
            _line.Width = double.NaN;
            _line.HorizontalAlignment = HorizontalAlignment.Stretch;
            _line.VerticalAlignment = VerticalAlignment.Center;
        }
        AutomationProperties.SetName(_line, "Separator");
    }
}
