// ============================================================
// Clef Surface WinUI Widget — BlockEditor
//
// Block-based content editor where each block is a typed
// content unit (paragraph, heading, image, etc.). Maps the
// blockeditor.widget spec to WinUI 3 StackPanel with dynamic
// block controls.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Collections.Generic;

namespace Clef.Surface.WinUI.Widgets.Domain;

public sealed class ClefBlockEditor : UserControl
{
    public event RoutedEventHandler ContentChanged;

    private readonly StackPanel _root;
    private readonly StackPanel _blocks;
    private readonly Button _addBlockBtn;

    public ClefBlockEditor()
    {
        _blocks = new StackPanel { Spacing = 4 };
        _addBlockBtn = new Button { Content = "+ Add Block" };
        _addBlockBtn.Click += (s, e) => AddTextBlock();
        _root = new StackPanel { Spacing = 8 };
        _root.Children.Add(_blocks);
        _root.Children.Add(_addBlockBtn);
        Content = _root;
    }

    public void AddTextBlock(string text = "")
    {
        var tb = new TextBox
        {
            Text = text,
            AcceptsReturn = true,
            TextWrapping = TextWrapping.Wrap,
            MinHeight = 40
        };
        var removeBtn = new Button { Content = new SymbolIcon(Symbol.Delete), VerticalAlignment = VerticalAlignment.Top };
        var row = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
        row.Children.Add(tb);
        row.Children.Add(removeBtn);
        removeBtn.Click += (s, e) => { _blocks.Children.Remove(row); ContentChanged?.Invoke(this, new RoutedEventArgs()); };
        tb.TextChanged += (s, e) => ContentChanged?.Invoke(this, new RoutedEventArgs());
        _blocks.Children.Add(row);
    }

    public void AddHeadingBlock(string text = "")
    {
        var tb = new TextBox
        {
            Text = text,
            FontSize = 20,
            FontWeight = Microsoft.UI.Text.FontWeights.Bold,
            MinHeight = 36
        };
        var removeBtn = new Button { Content = new SymbolIcon(Symbol.Delete), VerticalAlignment = VerticalAlignment.Top };
        var row = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
        row.Children.Add(tb);
        row.Children.Add(removeBtn);
        removeBtn.Click += (s, e) => _blocks.Children.Remove(row);
        _blocks.Children.Add(row);
    }

    public void Clear() => _blocks.Children.Clear();
}
