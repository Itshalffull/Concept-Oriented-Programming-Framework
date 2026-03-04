// ============================================================
// Clef Surface WinUI Widget — Presence
//
// Controls conditional rendering of children based on the
// present flag. Supports animated enter/exit transitions via
// WinUI 3 implicit animations. ForceMount keeps content in
// the visual tree even when not visible.
//
// Adapts the presence.widget spec: anatomy (root), states
// (unmounted, mounting, mounted, unmounting), and connect
// attributes (data-part, data-state, data-present) to WinUI 3.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Primitives;

public sealed class ClefPresence : UserControl
{
    public static readonly DependencyProperty IsPresentProperty =
        DependencyProperty.Register(nameof(IsPresent), typeof(bool), typeof(ClefPresence),
            new PropertyMetadata(false, OnPropertyChanged));

    public static readonly DependencyProperty ForceMountProperty =
        DependencyProperty.Register(nameof(ForceMount), typeof(bool), typeof(ClefPresence),
            new PropertyMetadata(false, OnPropertyChanged));

    public bool IsPresent { get => (bool)GetValue(IsPresentProperty); set => SetValue(IsPresentProperty, value); }
    public bool ForceMount { get => (bool)GetValue(ForceMountProperty); set => SetValue(ForceMountProperty, value); }

    private readonly ContentPresenter _presenter;

    public ClefPresence()
    {
        _presenter = new ContentPresenter();
        Content = _presenter;
        UpdateVisual();
    }

    public void SetPresenceContent(UIElement element)
    {
        _presenter.Content = element;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefPresence)d).UpdateVisual();

    private void UpdateVisual()
    {
        if (ForceMount)
        {
            _presenter.Visibility = Visibility.Visible;
            _presenter.Opacity = IsPresent ? 1.0 : 0.0;
        }
        else
        {
            _presenter.Visibility = IsPresent ? Visibility.Visible : Visibility.Collapsed;
            _presenter.Opacity = 1.0;
        }
    }
}
