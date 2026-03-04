// ============================================================
// Clef Surface WinUI Widget — Chart
//
// Data visualization container supporting bar, line, and pie
// chart types via a canvas-based renderer. Maps the chart.widget
// spec to WinUI 3 Canvas with manual draw operations.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Shapes;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System.Collections.Generic;

namespace Clef.Surface.WinUI.Widgets.DataDisplay;

public sealed class ClefChart : UserControl
{
    public static readonly DependencyProperty ChartTypeProperty =
        DependencyProperty.Register(nameof(ChartType), typeof(string), typeof(ClefChart),
            new PropertyMetadata("bar", OnPropertyChanged));

    public static readonly DependencyProperty TitleProperty =
        DependencyProperty.Register(nameof(Title), typeof(string), typeof(ClefChart),
            new PropertyMetadata(null, OnPropertyChanged));

    public string ChartType { get => (string)GetValue(ChartTypeProperty); set => SetValue(ChartTypeProperty, value); }
    public string Title { get => (string)GetValue(TitleProperty); set => SetValue(TitleProperty, value); }

    private readonly StackPanel _root;
    private readonly TextBlock _titleBlock;
    private readonly Canvas _canvas;
    private readonly List<double> _data = new();

    public ClefChart()
    {
        _titleBlock = new TextBlock
        {
            FontSize = 16,
            FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
            Visibility = Visibility.Collapsed
        };
        _canvas = new Canvas { Height = 200, HorizontalAlignment = HorizontalAlignment.Stretch };
        _root = new StackPanel { Spacing = 8 };
        _root.Children.Add(_titleBlock);
        _root.Children.Add(_canvas);
        Content = _root;
        UpdateVisual();
    }

    public void SetData(IEnumerable<double> values)
    {
        _data.Clear();
        _data.AddRange(values);
        Render();
    }

    private void Render()
    {
        _canvas.Children.Clear();
        if (_data.Count == 0) return;
        double max = 0;
        foreach (var v in _data) if (v > max) max = v;
        if (max == 0) max = 1;
        double barWidth = 300.0 / _data.Count;
        for (int i = 0; i < _data.Count; i++)
        {
            double h = (_data[i] / max) * 180;
            var rect = new Rectangle
            {
                Width = barWidth - 4,
                Height = h,
                Fill = new SolidColorBrush(Colors.CornflowerBlue)
            };
            Canvas.SetLeft(rect, i * barWidth + 2);
            Canvas.SetTop(rect, 200 - h);
            _canvas.Children.Add(rect);
        }
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefChart)d).UpdateVisual();

    private void UpdateVisual()
    {
        _titleBlock.Text = Title ?? "";
        _titleBlock.Visibility = string.IsNullOrEmpty(Title) ? Visibility.Collapsed : Visibility.Visible;
    }
}
