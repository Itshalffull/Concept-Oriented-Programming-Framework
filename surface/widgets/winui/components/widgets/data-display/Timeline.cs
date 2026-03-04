// ============================================================
// Clef Surface WinUI Widget — Timeline
//
// Vertical chronological display of events with timestamps.
// Each entry has a marker, title, and description. Maps the
// timeline.widget spec to WinUI 3 StackPanel with indicators.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Shapes;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;

namespace Clef.Surface.WinUI.Widgets.DataDisplay;

public sealed class ClefTimeline : UserControl
{
    private readonly StackPanel _root;

    public ClefTimeline()
    {
        _root = new StackPanel { Spacing = 0 };
        Content = _root;
    }

    public void AddEntry(string title, string description = null, string timestamp = null)
    {
        var marker = new Ellipse
        {
            Width = 12,
            Height = 12,
            Fill = new SolidColorBrush(Colors.CornflowerBlue),
            Margin = new Thickness(0, 4, 8, 0),
            VerticalAlignment = VerticalAlignment.Top
        };
        var line = new Border
        {
            Width = 2,
            Background = new SolidColorBrush(Colors.LightGray),
            HorizontalAlignment = HorizontalAlignment.Center,
            MinHeight = 24
        };
        var titleBlock = new TextBlock
        {
            Text = title,
            FontWeight = Microsoft.UI.Text.FontWeights.SemiBold
        };
        var textStack = new StackPanel { Spacing = 2 };
        if (!string.IsNullOrEmpty(timestamp))
            textStack.Children.Add(new TextBlock { Text = timestamp, FontSize = 11, Opacity = 0.5 });
        textStack.Children.Add(titleBlock);
        if (!string.IsNullOrEmpty(description))
            textStack.Children.Add(new TextBlock { Text = description, Opacity = 0.7, TextWrapping = TextWrapping.Wrap });

        var row = new StackPanel { Orientation = Orientation.Horizontal };
        var markerCol = new StackPanel { HorizontalAlignment = HorizontalAlignment.Center, Width = 24 };
        markerCol.Children.Add(marker);
        markerCol.Children.Add(line);
        row.Children.Add(markerCol);
        row.Children.Add(textStack);
        _root.Children.Add(row);
    }

    public void Clear() => _root.Children.Clear();
}
