// ============================================================
// Clef Surface WinUI Widget — CanvasConnector
//
// Visual connection line between two canvas nodes. Renders as
// a path or line with optional arrow. Maps the
// canvasconnector.widget spec to WinUI 3 Line shape.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Shapes;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;

namespace Clef.Surface.WinUI.Widgets.Domain;

public sealed class ClefCanvasConnector : UserControl
{
    public static readonly DependencyProperty X1Property =
        DependencyProperty.Register(nameof(X1), typeof(double), typeof(ClefCanvasConnector),
            new PropertyMetadata(0.0, OnPropertyChanged));

    public static readonly DependencyProperty Y1Property =
        DependencyProperty.Register(nameof(Y1), typeof(double), typeof(ClefCanvasConnector),
            new PropertyMetadata(0.0, OnPropertyChanged));

    public static readonly DependencyProperty X2Property =
        DependencyProperty.Register(nameof(X2), typeof(double), typeof(ClefCanvasConnector),
            new PropertyMetadata(100.0, OnPropertyChanged));

    public static readonly DependencyProperty Y2Property =
        DependencyProperty.Register(nameof(Y2), typeof(double), typeof(ClefCanvasConnector),
            new PropertyMetadata(100.0, OnPropertyChanged));

    public static readonly DependencyProperty StrokeColorProperty =
        DependencyProperty.Register(nameof(StrokeColor), typeof(string), typeof(ClefCanvasConnector),
            new PropertyMetadata("gray"));

    public double X1 { get => (double)GetValue(X1Property); set => SetValue(X1Property, value); }
    public double Y1 { get => (double)GetValue(Y1Property); set => SetValue(Y1Property, value); }
    public double X2 { get => (double)GetValue(X2Property); set => SetValue(X2Property, value); }
    public double Y2 { get => (double)GetValue(Y2Property); set => SetValue(Y2Property, value); }
    public string StrokeColor { get => (string)GetValue(StrokeColorProperty); set => SetValue(StrokeColorProperty, value); }

    private readonly Line _line;

    public ClefCanvasConnector()
    {
        _line = new Line
        {
            Stroke = new SolidColorBrush(Colors.Gray),
            StrokeThickness = 2
        };
        Content = _line;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefCanvasConnector)d).UpdateVisual();

    private void UpdateVisual()
    {
        _line.X1 = X1;
        _line.Y1 = Y1;
        _line.X2 = X2;
        _line.Y2 = Y2;
    }
}
