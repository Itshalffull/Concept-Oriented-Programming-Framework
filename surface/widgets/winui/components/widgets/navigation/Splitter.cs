// ============================================================
// Clef Surface WinUI Widget — Splitter
//
// Resizable split pane container. Divides content into two
// adjustable regions. Maps the splitter.widget spec to WinUI 3
// Grid with draggable handle.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Navigation;

public sealed class ClefSplitter : UserControl
{
    public static readonly DependencyProperty OrientationProperty =
        DependencyProperty.Register(nameof(Orientation), typeof(string), typeof(ClefSplitter),
            new PropertyMetadata("horizontal", OnPropertyChanged));

    public static readonly DependencyProperty InitialRatioProperty =
        DependencyProperty.Register(nameof(InitialRatio), typeof(double), typeof(ClefSplitter),
            new PropertyMetadata(0.5, OnPropertyChanged));

    public string Orientation { get => (string)GetValue(OrientationProperty); set => SetValue(OrientationProperty, value); }
    public double InitialRatio { get => (double)GetValue(InitialRatioProperty); set => SetValue(InitialRatioProperty, value); }

    private readonly Grid _grid;
    private readonly ContentPresenter _first;
    private readonly ContentPresenter _second;
    private readonly Border _handle;

    public ClefSplitter()
    {
        _first = new ContentPresenter();
        _second = new ContentPresenter();
        _handle = new Border
        {
            Background = new Microsoft.UI.Xaml.Media.SolidColorBrush(Microsoft.UI.Colors.Gray),
            Width = 4
        };
        _grid = new Grid();
        _grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        _grid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        _grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        Grid.SetColumn(_first, 0);
        Grid.SetColumn(_handle, 1);
        Grid.SetColumn(_second, 2);
        _grid.Children.Add(_first);
        _grid.Children.Add(_handle);
        _grid.Children.Add(_second);
        Content = _grid;
        UpdateVisual();
    }

    public void SetFirstContent(UIElement element) => _first.Content = element;
    public void SetSecondContent(UIElement element) => _second.Content = element;

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefSplitter)d).UpdateVisual();

    private void UpdateVisual()
    {
        if (Orientation == "vertical")
        {
            _handle.Width = double.NaN;
            _handle.Height = 4;
        }
        else
        {
            _handle.Width = 4;
            _handle.Height = double.NaN;
        }
    }
}
