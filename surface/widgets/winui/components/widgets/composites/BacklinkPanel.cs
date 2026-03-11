// ============================================================
// Clef Surface WinUI Widget — BacklinkPanel
//
// Displays a list of pages or items that reference the current
// item. Supports grouping by source type. Maps the
// backlinkpanel.widget spec to WinUI 3 ListView with headers.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Collections.Generic;

namespace Clef.Surface.WinUI.Widgets.Composites;

public sealed class ClefBacklinkPanel : UserControl
{
    public static readonly DependencyProperty TitleProperty =
        DependencyProperty.Register(nameof(Title), typeof(string), typeof(ClefBacklinkPanel),
            new PropertyMetadata("Backlinks", OnPropertyChanged));

    public string Title { get => (string)GetValue(TitleProperty); set => SetValue(TitleProperty, value); }

    public event System.EventHandler<string> LinkClicked;

    private readonly StackPanel _root;
    private readonly TextBlock _titleBlock;
    private readonly ListView _list;

    public ClefBacklinkPanel()
    {
        _titleBlock = new TextBlock
        {
            FontSize = 14,
            FontWeight = Microsoft.UI.Text.FontWeights.SemiBold
        };
        _list = new ListView { SelectionMode = ListViewSelectionMode.None };
        _root = new StackPanel { Spacing = 8 };
        _root.Children.Add(_titleBlock);
        _root.Children.Add(_list);
        Content = _root;
        UpdateVisual();
    }

    public void AddLink(string label, string target)
    {
        var link = new HyperlinkButton { Content = label, Tag = target };
        link.Click += (s, e) => LinkClicked?.Invoke(this, target);
        _list.Items.Add(link);
    }

    public void Clear() => _list.Items.Clear();

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefBacklinkPanel)d).UpdateVisual();

    private void UpdateVisual()
    {
        _titleBlock.Text = Title ?? "Backlinks";
    }
}
