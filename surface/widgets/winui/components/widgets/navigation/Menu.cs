// ============================================================
// Clef Surface WinUI Widget — Menu
//
// Dropdown menu displaying a list of actions or options.
// Supports nested submenus and keyboard navigation. Maps the
// menu.widget spec to WinUI 3 MenuFlyout.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Navigation;

public sealed class ClefMenu : UserControl
{
    public event System.EventHandler<string> ItemSelected;

    private readonly Button _trigger;
    private readonly MenuFlyout _flyout;

    public ClefMenu()
    {
        _flyout = new MenuFlyout();
        _trigger = new Button { Content = "Menu", Flyout = _flyout };
        Content = _trigger;
    }

    public void SetTriggerText(string text) => _trigger.Content = text;

    public void AddItem(string label, string value = null)
    {
        var item = new MenuFlyoutItem { Text = label };
        item.Click += (s, e) => ItemSelected?.Invoke(this, value ?? label);
        _flyout.Items.Add(item);
    }

    public void AddSeparator() => _flyout.Items.Add(new MenuFlyoutSeparator());

    public MenuFlyoutSubItem AddSubMenu(string label)
    {
        var sub = new MenuFlyoutSubItem { Text = label };
        _flyout.Items.Add(sub);
        return sub;
    }
}
