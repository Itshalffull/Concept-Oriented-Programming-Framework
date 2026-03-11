// ============================================================
// Clef Surface WinUI Widget — PreferenceMatrix
//
// Grid for rating or ranking multiple items across criteria.
// Rows are items, columns are criteria with radio/slider input.
// Maps the preferencematrix.widget spec to WinUI 3 Grid.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Collections.Generic;

namespace Clef.Surface.WinUI.Widgets.Composites;

public sealed class ClefPreferenceMatrix : UserControl
{
    public event System.EventHandler<(string Item, string Criterion, int Score)> ScoreChanged;

    private readonly ScrollViewer _scrollViewer;
    private readonly Grid _grid;

    public ClefPreferenceMatrix()
    {
        _grid = new Grid();
        _scrollViewer = new ScrollViewer
        {
            HorizontalScrollBarVisibility = ScrollBarVisibility.Auto,
            Content = _grid
        };
        Content = _scrollViewer;
    }

    public void Build(IEnumerable<string> items, IEnumerable<string> criteria, int maxScore = 5)
    {
        _grid.Children.Clear();
        _grid.ColumnDefinitions.Clear();
        _grid.RowDefinitions.Clear();
        var itemList = new List<string>(items);
        var critList = new List<string>(criteria);
        _grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(120) });
        foreach (var c in critList)
            _grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(100) });
        _grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        for (int c = 0; c < critList.Count; c++)
        {
            var hdr = new TextBlock { Text = critList[c], FontWeight = Microsoft.UI.Text.FontWeights.SemiBold, Margin = new Thickness(4) };
            Grid.SetRow(hdr, 0);
            Grid.SetColumn(hdr, c + 1);
            _grid.Children.Add(hdr);
        }
        for (int r = 0; r < itemList.Count; r++)
        {
            _grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            var label = new TextBlock { Text = itemList[r], Margin = new Thickness(4), VerticalAlignment = VerticalAlignment.Center };
            Grid.SetRow(label, r + 1);
            Grid.SetColumn(label, 0);
            _grid.Children.Add(label);
            for (int c = 0; c < critList.Count; c++)
            {
                string item = itemList[r], crit = critList[c];
                var nb = new NumberBox { Minimum = 0, Maximum = maxScore, Value = 0, SpinButtonPlacementMode = NumberBoxSpinButtonPlacementMode.Compact, Width = 80 };
                nb.ValueChanged += (s, e) => ScoreChanged?.Invoke(this, (item, crit, (int)nb.Value));
                Grid.SetRow(nb, r + 1);
                Grid.SetColumn(nb, c + 1);
                _grid.Children.Add(nb);
            }
        }
    }
}
