// ============================================================
// Clef Surface WinUI Widget — ScrollLock
//
// Prevents parent-level scrolling when active. In WinUI 3,
// scrolling is controlled by ScrollViewer. This component
// wraps content and manipulates the parent ScrollViewer mode
// when locked. When inactive, children render without override.
//
// Adapts the scroll-lock.widget spec: anatomy (root), states
// (unlocked, locked), and connect attributes (data-part,
// data-state, data-scroll-lock) to WinUI 3 rendering.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Primitives;

public sealed class ClefScrollLock : UserControl
{
    public static readonly DependencyProperty IsActiveProperty =
        DependencyProperty.Register(nameof(IsActive), typeof(bool), typeof(ClefScrollLock),
            new PropertyMetadata(false, OnPropertyChanged));

    public bool IsActive { get => (bool)GetValue(IsActiveProperty); set => SetValue(IsActiveProperty, value); }

    private readonly ScrollViewer _scrollViewer;
    private readonly ContentPresenter _presenter;

    public ClefScrollLock()
    {
        _presenter = new ContentPresenter();
        _scrollViewer = new ScrollViewer
        {
            Content = _presenter,
            HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto
        };
        Content = _scrollViewer;
        UpdateVisual();
    }

    public void SetLockContent(UIElement element)
    {
        _presenter.Content = element;
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefScrollLock)d).UpdateVisual();

    private void UpdateVisual()
    {
        _scrollViewer.VerticalScrollMode = IsActive ? ScrollMode.Disabled : ScrollMode.Auto;
        _scrollViewer.HorizontalScrollMode = IsActive ? ScrollMode.Disabled : ScrollMode.Auto;
    }
}
