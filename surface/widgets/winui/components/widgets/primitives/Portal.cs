// ============================================================
// Clef Surface WinUI Widget — Portal
//
// In DOM environments, a portal renders children into a
// different location in the tree. In WinUI 3, overlays are
// handled via Popup. This widget wraps content in a Popup
// when enabled, rendering inline otherwise.
//
// Adapts the portal.widget spec: anatomy (root), states
// (unmounted, mounted), and connect attributes (data-part,
// data-portal, data-state) to WinUI 3 rendering.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Controls.Primitives;

namespace Clef.Surface.WinUI.Widgets.Primitives;

public sealed class ClefPortal : UserControl
{
    public static readonly DependencyProperty IsDisabledProperty =
        DependencyProperty.Register(nameof(IsDisabled), typeof(bool), typeof(ClefPortal),
            new PropertyMetadata(false, OnPropertyChanged));

    public bool IsDisabled { get => (bool)GetValue(IsDisabledProperty); set => SetValue(IsDisabledProperty, value); }

    private readonly Grid _root;
    private readonly Popup _popup;
    private readonly ContentPresenter _inlinePresenter;
    private readonly ContentPresenter _popupPresenter;
    private UIElement _portalContent;

    public ClefPortal()
    {
        _root = new Grid();
        _inlinePresenter = new ContentPresenter();
        _popupPresenter = new ContentPresenter();
        _popup = new Popup { Child = _popupPresenter };
        _root.Children.Add(_inlinePresenter);
        Content = _root;
    }

    public void SetPortalContent(UIElement element)
    {
        _portalContent = element;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefPortal)d).UpdateVisual();

    private void UpdateVisual()
    {
        if (IsDisabled)
        {
            _popup.IsOpen = false;
            _popupPresenter.Content = null;
            _inlinePresenter.Content = _portalContent;
        }
        else
        {
            _inlinePresenter.Content = null;
            _popupPresenter.Content = _portalContent;
            _popup.IsOpen = true;
        }
    }
}
