// ============================================================
// Clef Surface WinUI Widget — Tabs
//
// Tabbed content switcher. Displays one content panel at a
// time with tab headers. Maps the tabs.widget spec to WinUI 3
// TabView.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Navigation;

public sealed class ClefTabs : UserControl
{
    public static readonly DependencyProperty IsClosableProperty =
        DependencyProperty.Register(nameof(IsClosable), typeof(bool), typeof(ClefTabs),
            new PropertyMetadata(false));

    public bool IsClosable { get => (bool)GetValue(IsClosableProperty); set => SetValue(IsClosableProperty, value); }

    public event System.EventHandler<int> TabChanged;
    public event System.EventHandler<int> TabClosed;

    private readonly TabView _tabView;

    public ClefTabs()
    {
        _tabView = new TabView { IsAddTabButtonVisible = false };
        _tabView.SelectionChanged += (s, e) => TabChanged?.Invoke(this, _tabView.SelectedIndex);
        _tabView.TabCloseRequested += (s, e) =>
        {
            int idx = _tabView.TabItems.IndexOf(e.Tab);
            _tabView.TabItems.Remove(e.Tab);
            TabClosed?.Invoke(this, idx);
        };
        Content = _tabView;
    }

    public void AddTab(string header, UIElement content)
    {
        var item = new TabViewItem
        {
            Header = header,
            Content = content,
            IsClosable = IsClosable
        };
        _tabView.TabItems.Add(item);
    }

    public void SelectTab(int index)
    {
        if (index >= 0 && index < _tabView.TabItems.Count)
            _tabView.SelectedIndex = index;
    }
}
