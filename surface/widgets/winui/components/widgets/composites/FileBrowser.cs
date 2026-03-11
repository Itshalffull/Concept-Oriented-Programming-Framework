// ============================================================
// Clef Surface WinUI Widget — FileBrowser
//
// Tree-based file system browser with icons for files and
// folders. Supports selection and navigation. Maps the
// filebrowser.widget spec to WinUI 3 TreeView.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Composites;

public sealed class ClefFileBrowser : UserControl
{
    public static readonly DependencyProperty RootPathProperty =
        DependencyProperty.Register(nameof(RootPath), typeof(string), typeof(ClefFileBrowser),
            new PropertyMetadata(null, OnPropertyChanged));

    public string RootPath { get => (string)GetValue(RootPathProperty); set => SetValue(RootPathProperty, value); }

    public event System.EventHandler<string> FileSelected;
    public event System.EventHandler<string> FolderSelected;

    private readonly StackPanel _root;
    private readonly TextBlock _pathBlock;
    private readonly TreeView _treeView;

    public ClefFileBrowser()
    {
        _pathBlock = new TextBlock
        {
            FontFamily = new Microsoft.UI.Xaml.Media.FontFamily("Consolas"),
            Opacity = 0.7,
            Margin = new Thickness(0, 0, 0, 8)
        };
        _treeView = new TreeView { SelectionMode = TreeViewSelectionMode.Single };
        _treeView.ItemInvoked += (s, e) =>
        {
            var node = e.InvokedItem as TreeViewNode;
            var path = node?.Content?.ToString();
            if (node?.HasChildren == true)
                FolderSelected?.Invoke(this, path);
            else
                FileSelected?.Invoke(this, path);
        };
        _root = new StackPanel();
        _root.Children.Add(_pathBlock);
        _root.Children.Add(_treeView);
        Content = _root;
        UpdateVisual();
    }

    public TreeViewNode AddFolder(string name, TreeViewNode parent = null)
    {
        var node = new TreeViewNode { Content = name, IsExpanded = false };
        if (parent != null) parent.Children.Add(node);
        else _treeView.RootNodes.Add(node);
        return node;
    }

    public void AddFile(string name, TreeViewNode parent)
    {
        parent.Children.Add(new TreeViewNode { Content = name });
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefFileBrowser)d).UpdateVisual();

    private void UpdateVisual()
    {
        _pathBlock.Text = RootPath ?? "";
    }
}
