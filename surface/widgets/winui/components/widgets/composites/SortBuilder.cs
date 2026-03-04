// ============================================================
// Clef Surface WinUI Widget — SortBuilder
//
// Multi-level sort configuration with add/remove/reorder sort
// criteria. Maps the sortbuilder.widget spec to WinUI 3
// StackPanel with dynamic rows.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Collections.Generic;

namespace Clef.Surface.WinUI.Widgets.Composites;

public sealed class ClefSortBuilder : UserControl
{
    public event System.EventHandler<List<(string Field, string Direction)>> SortChanged;

    private readonly StackPanel _root;
    private readonly StackPanel _rows;
    private readonly Button _addBtn;
    private readonly List<string> _fields = new();

    public ClefSortBuilder()
    {
        _rows = new StackPanel { Spacing = 8 };
        _addBtn = new Button { Content = "+ Add Sort" };
        _addBtn.Click += (s, e) => AddRow();
        _root = new StackPanel { Spacing = 8 };
        _root.Children.Add(new TextBlock { Text = "Sort By", FontWeight = Microsoft.UI.Text.FontWeights.SemiBold });
        _root.Children.Add(_rows);
        _root.Children.Add(_addBtn);
        Content = _root;
    }

    public void SetFields(IEnumerable<string> fields)
    {
        _fields.Clear();
        _fields.AddRange(fields);
    }

    public void AddRow()
    {
        var fieldCb = new ComboBox { PlaceholderText = "Field", Width = 150 };
        foreach (var f in _fields) fieldCb.Items.Add(f);
        var dirCb = new ComboBox { PlaceholderText = "Direction", Width = 120 };
        dirCb.Items.Add("Ascending");
        dirCb.Items.Add("Descending");
        dirCb.SelectedIndex = 0;
        var removeBtn = new Button { Content = new SymbolIcon(Symbol.Delete) };
        var row = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
        row.Children.Add(fieldCb);
        row.Children.Add(dirCb);
        row.Children.Add(removeBtn);
        removeBtn.Click += (s, e) => _rows.Children.Remove(row);
        _rows.Children.Add(row);
    }
}
