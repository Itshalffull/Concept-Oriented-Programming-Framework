// ============================================================
// Clef Surface WinUI Widget — FilterBuilder
//
// Visual filter/query builder with add/remove condition rows.
// Each row has field, operator, and value selectors. Maps the
// filterbuilder.widget spec to WinUI 3 StackPanel with
// dynamic rows.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Collections.Generic;

namespace Clef.Surface.WinUI.Widgets.Composites;

public sealed class ClefFilterBuilder : UserControl
{
    public event System.EventHandler<List<(string Field, string Op, string Value)>> FiltersChanged;

    private readonly StackPanel _root;
    private readonly StackPanel _rows;
    private readonly Button _addBtn;
    private readonly List<string> _fields = new();
    private readonly List<string> _operators = new() { "equals", "contains", "greater than", "less than" };

    public ClefFilterBuilder()
    {
        _rows = new StackPanel { Spacing = 8 };
        _addBtn = new Button { Content = "+ Add Filter" };
        _addBtn.Click += (s, e) => AddRow();
        _root = new StackPanel { Spacing = 8 };
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
        var fieldCb = new ComboBox { PlaceholderText = "Field", Width = 120 };
        foreach (var f in _fields) fieldCb.Items.Add(f);
        var opCb = new ComboBox { PlaceholderText = "Operator", Width = 120 };
        foreach (var o in _operators) opCb.Items.Add(o);
        var valueBox = new TextBox { PlaceholderText = "Value", Width = 150 };
        var removeBtn = new Button { Content = new SymbolIcon(Symbol.Delete) };
        var row = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
        row.Children.Add(fieldCb);
        row.Children.Add(opCb);
        row.Children.Add(valueBox);
        row.Children.Add(removeBtn);
        removeBtn.Click += (s, e) => { _rows.Children.Remove(row); };
        _rows.Children.Add(row);
    }
}
