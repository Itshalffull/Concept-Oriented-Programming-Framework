// ============================================================
// Clef Surface WinUI Widget — KanbanBoard
//
// Multi-column board for managing items across stages. Each
// column represents a status. Maps the kanbanboard.widget spec
// to WinUI 3 horizontal StackPanel with ListView columns.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Collections.Generic;

namespace Clef.Surface.WinUI.Widgets.DataDisplay;

public sealed class ClefKanbanBoard : UserControl
{
    public event System.EventHandler<string> CardMoved;

    private readonly ScrollViewer _scrollViewer;
    private readonly StackPanel _columns;
    private readonly Dictionary<string, ListView> _columnLists = new();

    public ClefKanbanBoard()
    {
        _columns = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 12 };
        _scrollViewer = new ScrollViewer
        {
            HorizontalScrollBarVisibility = ScrollBarVisibility.Auto,
            Content = _columns
        };
        Content = _scrollViewer;
    }

    public void AddColumn(string title)
    {
        var header = new TextBlock
        {
            Text = title,
            FontSize = 14,
            FontWeight = Microsoft.UI.Text.FontWeights.Bold,
            Margin = new Thickness(0, 0, 0, 8)
        };
        var list = new ListView
        {
            Width = 250,
            MinHeight = 200,
            AllowDrop = true,
            CanReorderItems = true
        };
        var column = new StackPanel { Spacing = 4 };
        column.Children.Add(header);
        column.Children.Add(new Border
        {
            Background = new Microsoft.UI.Xaml.Media.SolidColorBrush(Microsoft.UI.Colors.LightGray),
            CornerRadius = new CornerRadius(4),
            Padding = new Thickness(8),
            Child = list
        });
        _columnLists[title] = list;
        _columns.Children.Add(column);
    }

    public void AddCard(string columnTitle, object card)
    {
        if (_columnLists.TryGetValue(columnTitle, out var list))
            list.Items.Add(card);
    }
}
