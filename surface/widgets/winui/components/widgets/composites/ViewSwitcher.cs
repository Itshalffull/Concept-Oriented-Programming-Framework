// ============================================================
// Clef Surface WinUI Widget — ViewSwitcher
//
// Container that switches between multiple named views using
// a selector control. Maps the viewswitcher.widget spec to
// WinUI 3 Pivot or StackPanel with content switching.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Collections.Generic;

namespace Clef.Surface.WinUI.Widgets.Composites;

public sealed class ClefViewSwitcher : UserControl
{
    public static readonly DependencyProperty SelectedViewProperty =
        DependencyProperty.Register(nameof(SelectedView), typeof(string), typeof(ClefViewSwitcher),
            new PropertyMetadata(null));

    public string SelectedView { get => (string)GetValue(SelectedViewProperty); set => SetValue(SelectedViewProperty, value); }

    public event System.EventHandler<string> ViewChanged;

    private readonly StackPanel _root;
    private readonly StackPanel _selector;
    private readonly ContentPresenter _content;
    private readonly Dictionary<string, UIElement> _views = new();
    private readonly Dictionary<string, ToggleButton> _buttons = new();

    public ClefViewSwitcher()
    {
        _selector = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
        _content = new ContentPresenter();
        _root = new StackPanel { Spacing = 8 };
        _root.Children.Add(_selector);
        _root.Children.Add(_content);
        Content = _root;
    }

    public void AddView(string name, UIElement content)
    {
        _views[name] = content;
        var btn = new ToggleButton { Content = name };
        btn.Click += (s, e) =>
        {
            SelectedView = name;
            SwitchTo(name);
            ViewChanged?.Invoke(this, name);
        };
        _buttons[name] = btn;
        _selector.Children.Add(btn);
        if (_views.Count == 1) { SelectedView = name; SwitchTo(name); }
    }

    private void SwitchTo(string name)
    {
        foreach (var kvp in _buttons) kvp.Value.IsChecked = kvp.Key == name;
        if (_views.TryGetValue(name, out var view))
            _content.Content = view;
    }
}
