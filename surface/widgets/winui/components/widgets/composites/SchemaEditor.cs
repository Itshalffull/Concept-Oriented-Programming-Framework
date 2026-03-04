// ============================================================
// Clef Surface WinUI Widget — SchemaEditor
//
// Visual editor for defining data schemas with fields, types,
// and constraints. Maps the schemaeditor.widget spec to WinUI 3
// StackPanel with dynamic field rows.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Collections.Generic;

namespace Clef.Surface.WinUI.Widgets.Composites;

public sealed class ClefSchemaEditor : UserControl
{
    public event System.EventHandler<List<(string Name, string Type, bool Required)>> SchemaChanged;

    private readonly StackPanel _root;
    private readonly StackPanel _fields;
    private readonly Button _addFieldBtn;
    private readonly List<string> _types = new() { "string", "number", "boolean", "date", "object", "array" };

    public ClefSchemaEditor()
    {
        _fields = new StackPanel { Spacing = 8 };
        _addFieldBtn = new Button { Content = "+ Add Field" };
        _addFieldBtn.Click += (s, e) => AddFieldRow();
        _root = new StackPanel { Spacing = 12 };
        _root.Children.Add(new TextBlock { Text = "Schema Editor", FontSize = 16, FontWeight = Microsoft.UI.Text.FontWeights.Bold });
        _root.Children.Add(_fields);
        _root.Children.Add(_addFieldBtn);
        Content = _root;
    }

    public void AddFieldRow(string name = "", string type = "string", bool required = false)
    {
        var nameBox = new TextBox { PlaceholderText = "Field name", Text = name, Width = 150 };
        var typeCb = new ComboBox { PlaceholderText = "Type", Width = 100 };
        foreach (var t in _types) typeCb.Items.Add(t);
        typeCb.SelectedItem = type;
        var reqCb = new CheckBox { Content = "Required", IsChecked = required };
        var removeBtn = new Button { Content = new SymbolIcon(Symbol.Delete) };
        var row = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
        row.Children.Add(nameBox);
        row.Children.Add(typeCb);
        row.Children.Add(reqCb);
        row.Children.Add(removeBtn);
        removeBtn.Click += (s, e) => _fields.Children.Remove(row);
        _fields.Children.Add(row);
    }
}
