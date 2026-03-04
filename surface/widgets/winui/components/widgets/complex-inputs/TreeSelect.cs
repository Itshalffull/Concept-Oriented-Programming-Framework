// ============================================================
// Clef Surface WinUI Widget — TreeSelect
//
// Hierarchical dropdown tree selection. Users can expand/
// collapse nodes and select leaf or branch items. Maps the
// treeselect.widget spec to WinUI 3 TreeView inside a Flyout.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.ComplexInputs;

public sealed class ClefTreeSelect : UserControl
{
    public static readonly DependencyProperty PlaceholderProperty =
        DependencyProperty.Register(nameof(Placeholder), typeof(string), typeof(ClefTreeSelect),
            new PropertyMetadata("Select...", OnPropertyChanged));

    public static readonly DependencyProperty SelectionModeProperty =
        DependencyProperty.Register(nameof(SelectionMode), typeof(string), typeof(ClefTreeSelect),
            new PropertyMetadata("single", OnPropertyChanged));

    public string Placeholder { get => (string)GetValue(PlaceholderProperty); set => SetValue(PlaceholderProperty, value); }
    public string SelectionMode { get => (string)GetValue(SelectionModeProperty); set => SetValue(SelectionModeProperty, value); }

    public event System.EventHandler<string> ItemSelected;

    private readonly Button _trigger;
    private readonly Flyout _flyout;
    private readonly TreeView _treeView;

    public ClefTreeSelect()
    {
        _treeView = new TreeView { MaxHeight = 300 };
        _treeView.ItemInvoked += (s, e) =>
        {
            var text = e.InvokedItem?.ToString();
            _trigger.Content = text;
            ItemSelected?.Invoke(this, text);
            _flyout.Hide();
        };
        _flyout = new Flyout { Content = _treeView };
        _trigger = new Button { Flyout = _flyout };
        Content = _trigger;
        UpdateVisual();
    }

    public TreeViewNode AddRootNode(string label)
    {
        var node = new TreeViewNode { Content = label };
        _treeView.RootNodes.Add(node);
        return node;
    }

    public TreeViewNode AddChildNode(TreeViewNode parent, string label)
    {
        var node = new TreeViewNode { Content = label };
        parent.Children.Add(node);
        return node;
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefTreeSelect)d).UpdateVisual();

    private void UpdateVisual()
    {
        _trigger.Content = Placeholder;
        _treeView.SelectionMode = SelectionMode == "multiple"
            ? TreeViewSelectionMode.Multiple
            : TreeViewSelectionMode.Single;
    }
}
