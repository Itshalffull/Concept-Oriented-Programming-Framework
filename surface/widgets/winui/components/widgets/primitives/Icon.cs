// ============================================================
// Clef Surface WinUI Widget — Icon
//
// Renders a named icon using WinUI 3 SymbolIcon or FontIcon.
// Maps common icon names to their Symbol equivalents. Unknown
// names fall back to a diamond glyph. Supports an accessible
// label for semantic icons.
//
// Adapts the icon.widget spec: anatomy (root), states (static),
// and connect attributes (data-part, data-icon, data-size,
// role, aria-hidden, aria-label) to WinUI 3 rendering.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Collections.Generic;

namespace Clef.Surface.WinUI.Widgets.Primitives;

public sealed class ClefIcon : UserControl
{
    public static readonly DependencyProperty NameProperty =
        DependencyProperty.Register(nameof(Name), typeof(string), typeof(ClefIcon),
            new PropertyMetadata("", OnPropertyChanged));

    public static readonly DependencyProperty SizeProperty =
        DependencyProperty.Register(nameof(Size), typeof(string), typeof(ClefIcon),
            new PropertyMetadata("md", OnPropertyChanged));

    public static readonly DependencyProperty LabelProperty =
        DependencyProperty.Register(nameof(Label), typeof(string), typeof(ClefIcon),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty IsDecorativeProperty =
        DependencyProperty.Register(nameof(IsDecorative), typeof(bool), typeof(ClefIcon),
            new PropertyMetadata(true, OnPropertyChanged));

    public string Name { get => (string)GetValue(NameProperty); set => SetValue(NameProperty, value); }
    public string Size { get => (string)GetValue(SizeProperty); set => SetValue(SizeProperty, value); }
    public string Label { get => (string)GetValue(LabelProperty); set => SetValue(LabelProperty, value); }
    public bool IsDecorative { get => (bool)GetValue(IsDecorativeProperty); set => SetValue(IsDecorativeProperty, value); }

    private static readonly Dictionary<string, Symbol> IconMap = new()
    {
        ["check"] = Symbol.Accept, ["close"] = Symbol.Cancel, ["x"] = Symbol.Cancel,
        ["arrow-right"] = Symbol.Forward, ["arrow-left"] = Symbol.Back,
        ["arrow-up"] = Symbol.Up, ["arrow-down"] = Symbol.Download,
        ["plus"] = Symbol.Add, ["minus"] = Symbol.Remove,
        ["search"] = Symbol.Find, ["star"] = Symbol.Favorite,
        ["heart"] = Symbol.Like, ["info"] = Symbol.Help,
        ["warning"] = Symbol.Important, ["error"] = Symbol.ReportHacked,
        ["success"] = Symbol.Accept, ["home"] = Symbol.Home,
        ["settings"] = Symbol.Setting, ["edit"] = Symbol.Edit,
        ["delete"] = Symbol.Delete, ["trash"] = Symbol.Delete,
        ["copy"] = Symbol.Copy, ["link"] = Symbol.Link,
        ["mail"] = Symbol.Mail, ["lock"] = Symbol.Permissions,
        ["eye"] = Symbol.View, ["menu"] = Symbol.List,
        ["more"] = Symbol.More, ["refresh"] = Symbol.Refresh,
        ["download"] = Symbol.Download, ["upload"] = Symbol.Upload,
        ["filter"] = Symbol.Filter, ["sort"] = Symbol.Sort,
        ["calendar"] = Symbol.Calendar, ["clock"] = Symbol.Clock,
        ["user"] = Symbol.Contact, ["folder"] = Symbol.Folder,
        ["file"] = Symbol.Document
    };

    private readonly Grid _root;

    public ClefIcon()
    {
        _root = new Grid();
        Content = _root;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefIcon)d).UpdateVisual();

    private void UpdateVisual()
    {
        _root.Children.Clear();
        var sizePx = Size switch { "sm" => 16.0, "lg" => 32.0, _ => 24.0 };
        var name = (Name ?? "").ToLowerInvariant();

        if (IconMap.TryGetValue(name, out var symbol))
        {
            var icon = new SymbolIcon(symbol) { Width = sizePx, Height = sizePx };
            if (!IsDecorative && Label != null)
                AutomationProperties.SetName(icon, Label);
            _root.Children.Add(icon);
        }
        else
        {
            var fallback = new FontIcon { Glyph = "\u25C6", FontSize = sizePx };
            if (!IsDecorative && Label != null)
                AutomationProperties.SetName(fallback, Label);
            _root.Children.Add(fallback);
        }
    }
}
