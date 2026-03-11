// ============================================================
// Clef Surface WinUI Widget — DiffViewer
//
// Side-by-side or unified diff display for comparing text.
// Highlights additions, deletions, and modifications. Maps
// the diffviewer.widget spec to WinUI 3 RichTextBlock pair.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;

namespace Clef.Surface.WinUI.Widgets.Composites;

public sealed class ClefDiffViewer : UserControl
{
    public static readonly DependencyProperty ViewModeProperty =
        DependencyProperty.Register(nameof(ViewMode), typeof(string), typeof(ClefDiffViewer),
            new PropertyMetadata("split", OnPropertyChanged));

    public string ViewMode { get => (string)GetValue(ViewModeProperty); set => SetValue(ViewModeProperty, value); }

    private readonly Grid _splitView;
    private readonly StackPanel _unifiedView;
    private readonly ScrollViewer _leftScroll;
    private readonly ScrollViewer _rightScroll;
    private readonly StackPanel _leftPanel;
    private readonly StackPanel _rightPanel;
    private readonly StackPanel _unifiedPanel;

    public ClefDiffViewer()
    {
        _leftPanel = new StackPanel { Spacing = 0 };
        _rightPanel = new StackPanel { Spacing = 0 };
        _unifiedPanel = new StackPanel { Spacing = 0 };
        _leftScroll = new ScrollViewer { Content = _leftPanel };
        _rightScroll = new ScrollViewer { Content = _rightPanel };
        _splitView = new Grid();
        _splitView.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        _splitView.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        Grid.SetColumn(_leftScroll, 0);
        Grid.SetColumn(_rightScroll, 1);
        _splitView.Children.Add(_leftScroll);
        _splitView.Children.Add(_rightScroll);
        _unifiedView = new StackPanel { Visibility = Visibility.Collapsed };
        _unifiedView.Children.Add(new ScrollViewer { Content = _unifiedPanel });
        var root = new Grid();
        root.Children.Add(_splitView);
        root.Children.Add(_unifiedView);
        Content = root;
        UpdateVisual();
    }

    public void AddLine(string text, string type)
    {
        var bg = type switch
        {
            "added" => new SolidColorBrush(Colors.LightGreen),
            "removed" => new SolidColorBrush(Colors.LightPink),
            _ => null
        };
        var prefix = type switch { "added" => "+ ", "removed" => "- ", _ => "  " };
        var block = new TextBlock
        {
            Text = prefix + text,
            FontFamily = new FontFamily("Consolas"),
            Background = bg,
            Padding = new Thickness(4, 1, 4, 1)
        };
        _unifiedPanel.Children.Add(block);
        if (type == "removed") _leftPanel.Children.Add(new TextBlock { Text = text, FontFamily = new FontFamily("Consolas"), Background = bg, Padding = new Thickness(4, 1, 4, 1) });
        else if (type == "added") _rightPanel.Children.Add(new TextBlock { Text = text, FontFamily = new FontFamily("Consolas"), Background = bg, Padding = new Thickness(4, 1, 4, 1) });
        else
        {
            _leftPanel.Children.Add(new TextBlock { Text = text, FontFamily = new FontFamily("Consolas"), Padding = new Thickness(4, 1, 4, 1) });
            _rightPanel.Children.Add(new TextBlock { Text = text, FontFamily = new FontFamily("Consolas"), Padding = new Thickness(4, 1, 4, 1) });
        }
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefDiffViewer)d).UpdateVisual();

    private void UpdateVisual()
    {
        _splitView.Visibility = ViewMode == "split" ? Visibility.Visible : Visibility.Collapsed;
        _unifiedView.Visibility = ViewMode == "unified" ? Visibility.Visible : Visibility.Collapsed;
    }
}
