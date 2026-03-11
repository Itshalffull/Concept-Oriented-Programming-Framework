// ============================================================
// Clef Surface WinUI Widget — DataList
//
// Vertical list of labeled data items. Renders key-value pairs
// with optional grouping. Maps the datalist.widget spec to
// WinUI 3 ItemsRepeater with StackLayout.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Collections.Generic;

namespace Clef.Surface.WinUI.Widgets.DataDisplay;

public sealed class ClefDataList : UserControl
{
    public static readonly DependencyProperty OrientationProperty =
        DependencyProperty.Register(nameof(Orientation), typeof(string), typeof(ClefDataList),
            new PropertyMetadata("vertical"));

    public string Orientation { get => (string)GetValue(OrientationProperty); set => SetValue(OrientationProperty, value); }

    private readonly StackPanel _root;

    public ClefDataList()
    {
        _root = new StackPanel { Spacing = 8 };
        Content = _root;
    }

    public void AddItem(string label, string value)
    {
        var row = new StackPanel { Orientation = Microsoft.UI.Xaml.Controls.Orientation.Horizontal, Spacing = 8 };
        row.Children.Add(new TextBlock
        {
            Text = label,
            FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
            Width = 120
        });
        row.Children.Add(new TextBlock { Text = value, TextWrapping = TextWrapping.Wrap });
        _root.Children.Add(row);
    }

    public void Clear() => _root.Children.Clear();
}
