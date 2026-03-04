// ============================================================
// Clef Surface WinUI Widget — NavigationMenu
//
// Primary application navigation with expandable groups. Maps
// the navigationmenu.widget spec to WinUI 3 NavigationView.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Navigation;

public sealed class ClefNavigationMenu : UserControl
{
    public static readonly DependencyProperty IsPaneOpenProperty =
        DependencyProperty.Register(nameof(IsPaneOpen), typeof(bool), typeof(ClefNavigationMenu),
            new PropertyMetadata(true, OnPropertyChanged));

    public static readonly DependencyProperty HeaderTextProperty =
        DependencyProperty.Register(nameof(HeaderText), typeof(string), typeof(ClefNavigationMenu),
            new PropertyMetadata(null, OnPropertyChanged));

    public bool IsPaneOpen { get => (bool)GetValue(IsPaneOpenProperty); set => SetValue(IsPaneOpenProperty, value); }
    public string HeaderText { get => (string)GetValue(HeaderTextProperty); set => SetValue(HeaderTextProperty, value); }

    public event System.EventHandler<string> NavigationItemSelected;

    private readonly NavigationView _navView;

    public ClefNavigationMenu()
    {
        _navView = new NavigationView { IsBackButtonVisible = NavigationViewBackButtonVisible.Collapsed };
        _navView.SelectionChanged += (s, e) =>
        {
            if (e.SelectedItem is NavigationViewItem item)
                NavigationItemSelected?.Invoke(this, item.Tag?.ToString());
        };
        Content = _navView;
        UpdateVisual();
    }

    public void AddItem(string label, string tag, Symbol icon)
    {
        _navView.MenuItems.Add(new NavigationViewItem
        {
            Content = label,
            Tag = tag,
            Icon = new SymbolIcon(icon)
        });
    }

    public void AddSeparator() => _navView.MenuItems.Add(new NavigationViewItemSeparator());

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefNavigationMenu)d).UpdateVisual();

    private void UpdateVisual()
    {
        _navView.IsPaneOpen = IsPaneOpen;
        _navView.Header = HeaderText;
    }
}
