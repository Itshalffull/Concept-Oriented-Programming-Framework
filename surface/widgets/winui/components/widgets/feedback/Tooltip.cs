// ============================================================
// Clef Surface WinUI Widget — Tooltip
//
// Lightweight floating label that provides supplementary
// descriptive text for a trigger element. Shown on hover.
//
// Adapts the tooltip.widget spec to WinUI 3 ToolTip control.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Feedback;

public sealed class ClefTooltip : UserControl
{
    public static readonly DependencyProperty TooltipTextProperty =
        DependencyProperty.Register(nameof(TooltipText), typeof(string), typeof(ClefTooltip),
            new PropertyMetadata("", OnPropertyChanged));

    public string TooltipText { get => (string)GetValue(TooltipTextProperty); set => SetValue(TooltipTextProperty, value); }

    private readonly Grid _root;

    public ClefTooltip()
    {
        _root = new Grid();
        Content = _root;
    }

    public void SetTrigger(UIElement trigger)
    {
        _root.Children.Clear();
        _root.Children.Add(trigger);
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefTooltip)d).UpdateVisual();

    private void UpdateVisual()
    {
        if (_root.Children.Count > 0)
        {
            ToolTipService.SetToolTip(_root.Children[0], new ToolTip { Content = TooltipText });
        }
    }
}
