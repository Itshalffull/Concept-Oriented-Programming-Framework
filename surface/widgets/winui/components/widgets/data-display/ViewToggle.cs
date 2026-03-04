// ============================================================
// Clef Surface WinUI Widget — ViewToggle
//
// Toggle between different view modes (grid, list, etc.).
// Displays icon buttons for each available view. Maps the
// viewtoggle.widget spec to WinUI 3 StackPanel with
// ToggleButtons.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Collections.Generic;

namespace Clef.Surface.WinUI.Widgets.DataDisplay;

public sealed class ClefViewToggle : UserControl
{
    public static readonly DependencyProperty SelectedViewProperty =
        DependencyProperty.Register(nameof(SelectedView), typeof(string), typeof(ClefViewToggle),
            new PropertyMetadata(null, OnPropertyChanged));

    public string SelectedView { get => (string)GetValue(SelectedViewProperty); set => SetValue(SelectedViewProperty, value); }

    public event System.EventHandler<string> ViewChanged;

    private readonly StackPanel _root;
    private readonly Dictionary<string, ToggleButton> _buttons = new();

    public ClefViewToggle()
    {
        _root = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
        Content = _root;
    }

    public void AddView(string name, Symbol icon)
    {
        var btn = new ToggleButton { Content = new SymbolIcon(icon), Tag = name };
        btn.Click += (s, e) =>
        {
            SelectedView = name;
            ViewChanged?.Invoke(this, name);
            UpdateSelection();
        };
        _buttons[name] = btn;
        _root.Children.Add(btn);
        if (_buttons.Count == 1) { SelectedView = name; UpdateSelection(); }
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefViewToggle)d).UpdateSelection();

    private void UpdateSelection()
    {
        foreach (var kvp in _buttons)
            kvp.Value.IsChecked = kvp.Key == SelectedView;
    }
}
