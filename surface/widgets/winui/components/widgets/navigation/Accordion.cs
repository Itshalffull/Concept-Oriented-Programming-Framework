// ============================================================
// Clef Surface WinUI Widget — Accordion
//
// Vertically stacked set of collapsible sections. Only one or
// multiple sections may be expanded at a time. Maps the
// accordion.widget spec to WinUI 3 Expander controls.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Collections.Generic;

namespace Clef.Surface.WinUI.Widgets.Navigation;

public sealed class ClefAccordion : UserControl
{
    public static readonly DependencyProperty AllowMultipleProperty =
        DependencyProperty.Register(nameof(AllowMultiple), typeof(bool), typeof(ClefAccordion),
            new PropertyMetadata(false));

    public bool AllowMultiple { get => (bool)GetValue(AllowMultipleProperty); set => SetValue(AllowMultipleProperty, value); }

    private readonly StackPanel _root;
    private readonly List<Expander> _expanders = new();

    public ClefAccordion()
    {
        _root = new StackPanel { Spacing = 2 };
        Content = _root;
    }

    public void AddSection(string header, UIElement content)
    {
        var expander = new Expander
        {
            Header = header,
            Content = content,
            HorizontalAlignment = HorizontalAlignment.Stretch
        };
        expander.Expanding += (s, e) =>
        {
            if (!AllowMultiple)
            {
                foreach (var ex in _expanders)
                    if (ex != s) ex.IsExpanded = false;
            }
        };
        _expanders.Add(expander);
        _root.Children.Add(expander);
    }
}
