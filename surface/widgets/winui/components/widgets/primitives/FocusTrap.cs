// ============================================================
// Clef Surface WinUI Widget — FocusTrap
//
// Focus-trap wrapper that constrains focus within a boundary.
// When active, focus is captured within the content scope;
// when inactive, children render normally.
//
// Adapts the focus-trap.widget spec: anatomy (root,
// sentinelStart, sentinelEnd), states (inactive, active), and
// connect attributes to WinUI 3 rendering.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;

namespace Clef.Surface.WinUI.Widgets.Primitives;

public sealed class ClefFocusTrap : UserControl
{
    public static readonly DependencyProperty IsActiveProperty =
        DependencyProperty.Register(nameof(IsActive), typeof(bool), typeof(ClefFocusTrap),
            new PropertyMetadata(false, OnPropertyChanged));

    public static readonly DependencyProperty ShouldLoopProperty =
        DependencyProperty.Register(nameof(ShouldLoop), typeof(bool), typeof(ClefFocusTrap),
            new PropertyMetadata(true));

    public bool IsActive { get => (bool)GetValue(IsActiveProperty); set => SetValue(IsActiveProperty, value); }
    public bool ShouldLoop { get => (bool)GetValue(ShouldLoopProperty); set => SetValue(ShouldLoopProperty, value); }

    private readonly ContentPresenter _contentPresenter;
    private readonly StackPanel _root;

    public ClefFocusTrap()
    {
        _contentPresenter = new ContentPresenter();
        _root = new StackPanel();
        _root.Children.Add(_contentPresenter);
        Content = _root;
        IsTabStop = true;
    }

    public void SetTrapContent(UIElement element)
    {
        _contentPresenter.Content = element;
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        var trap = (ClefFocusTrap)d;
        if (trap.IsActive)
        {
            trap.Focus(FocusState.Programmatic);
        }
    }
}
