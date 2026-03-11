// ============================================================
// Clef Surface WinUI Widget — CardGrid
//
// Responsive grid layout for Card widgets. Automatically wraps
// cards based on available width. Maps the cardgrid.widget spec
// to WinUI 3 ItemsRepeater with UniformGridLayout.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.DataDisplay;

public sealed class ClefCardGrid : UserControl
{
    public static readonly DependencyProperty MinColumnWidthProperty =
        DependencyProperty.Register(nameof(MinColumnWidth), typeof(double), typeof(ClefCardGrid),
            new PropertyMetadata(250.0, OnPropertyChanged));

    public static readonly DependencyProperty SpacingProperty =
        DependencyProperty.Register(nameof(Spacing), typeof(double), typeof(ClefCardGrid),
            new PropertyMetadata(12.0, OnPropertyChanged));

    public double MinColumnWidth { get => (double)GetValue(MinColumnWidthProperty); set => SetValue(MinColumnWidthProperty, value); }
    public double Spacing { get => (double)GetValue(SpacingProperty); set => SetValue(SpacingProperty, value); }

    private readonly ItemsRepeater _repeater;
    private readonly UniformGridLayout _layout;
    private readonly ScrollViewer _scrollViewer;

    public ClefCardGrid()
    {
        _layout = new UniformGridLayout
        {
            MinItemWidth = 250,
            MinColumnSpacing = 12,
            MinRowSpacing = 12
        };
        _repeater = new ItemsRepeater { Layout = _layout };
        _scrollViewer = new ScrollViewer { Content = _repeater };
        Content = _scrollViewer;
        UpdateVisual();
    }

    public void SetItemsSource(object source) => _repeater.ItemsSource = source;
    public void SetItemTemplate(DataTemplate template) => _repeater.ItemTemplate = template;

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefCardGrid)d).UpdateVisual();

    private void UpdateVisual()
    {
        _layout.MinItemWidth = MinColumnWidth;
        _layout.MinColumnSpacing = Spacing;
        _layout.MinRowSpacing = Spacing;
    }
}
