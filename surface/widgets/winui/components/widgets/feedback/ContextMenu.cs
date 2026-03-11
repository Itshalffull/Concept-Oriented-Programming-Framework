// ============================================================
// Clef Surface WinUI Widget — ContextMenu
//
// Contextual action menu anchored to a trigger element.
// Supports item labels, optional keyboard shortcut hints,
// disabled items, and destructive (danger) styling.
//
// Adapts the context-menu.widget spec to WinUI 3 MenuFlyout.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System.Collections.Generic;

namespace Clef.Surface.WinUI.Widgets.Feedback;

public record ContextMenuItem(string Label, string Shortcut = null, bool Disabled = false, bool Danger = false);

public sealed class ClefContextMenu : UserControl
{
    public event System.EventHandler<int> ItemSelected;

    private readonly Grid _root;
    private readonly MenuFlyout _menuFlyout;
    private List<ContextMenuItem> _items = new();

    public ClefContextMenu()
    {
        _root = new Grid();
        _menuFlyout = new MenuFlyout();
        Content = _root;
    }

    public void SetTrigger(UIElement trigger)
    {
        _root.Children.Clear();
        _root.Children.Add(trigger);
        trigger.ContextFlyout = _menuFlyout;
    }

    public void SetItems(List<ContextMenuItem> items)
    {
        _items = items;
        RebuildMenu();
    }

    private void RebuildMenu()
    {
        _menuFlyout.Items.Clear();
        for (int i = 0; i < _items.Count; i++)
        {
            var item = _items[i];
            var idx = i;
            var menuItem = new MenuFlyoutItem
            {
                Text = item.Label,
                IsEnabled = !item.Disabled,
            };
            if (item.Danger)
                menuItem.Foreground = new SolidColorBrush(Colors.Red);
            if (!string.IsNullOrEmpty(item.Shortcut))
            {
                menuItem.KeyboardAcceleratorTextOverride = item.Shortcut;
            }
            menuItem.Click += (s, e) => ItemSelected?.Invoke(this, idx);
            _menuFlyout.Items.Add(menuItem);
        }
    }
}
