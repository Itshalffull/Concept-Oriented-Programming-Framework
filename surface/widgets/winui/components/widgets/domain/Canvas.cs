// ============================================================
// Clef Surface WinUI Widget — Canvas
//
// Infinite, pannable canvas surface for placing and connecting
// nodes. Provides zoom/pan controls. Maps the canvas.widget
// spec to WinUI 3 ScrollViewer with Canvas.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Domain;

public sealed class ClefCanvas : UserControl
{
    public static readonly DependencyProperty ZoomLevelProperty =
        DependencyProperty.Register(nameof(ZoomLevel), typeof(double), typeof(ClefCanvas),
            new PropertyMetadata(1.0, OnPropertyChanged));

    public double ZoomLevel { get => (double)GetValue(ZoomLevelProperty); set => SetValue(ZoomLevelProperty, value); }

    public event System.EventHandler<(double X, double Y)> CanvasClicked;

    private readonly ScrollViewer _scrollViewer;
    private readonly Canvas _canvas;

    public ClefCanvas()
    {
        _canvas = new Canvas { Width = 3000, Height = 3000 };
        _canvas.PointerPressed += (s, e) =>
        {
            var pos = e.GetCurrentPoint(_canvas);
            CanvasClicked?.Invoke(this, (pos.Position.X, pos.Position.Y));
        };
        _scrollViewer = new ScrollViewer
        {
            HorizontalScrollBarVisibility = ScrollBarVisibility.Auto,
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            ZoomMode = ZoomMode.Enabled,
            MinZoomFactor = 0.25f,
            MaxZoomFactor = 4.0f,
            Content = _canvas
        };
        Content = _scrollViewer;
        UpdateVisual();
    }

    public void AddElement(UIElement element, double x, double y)
    {
        Canvas.SetLeft(element, x);
        Canvas.SetTop(element, y);
        _canvas.Children.Add(element);
    }

    public void ClearCanvas() => _canvas.Children.Clear();

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefCanvas)d).UpdateVisual();

    private void UpdateVisual()
    {
        _scrollViewer.ChangeView(null, null, (float)ZoomLevel);
    }
}
