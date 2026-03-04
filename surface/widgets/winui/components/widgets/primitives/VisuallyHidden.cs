// ============================================================
// Clef Surface WinUI Widget — VisuallyHidden
//
// Renders content that is invisible to sighted users but
// accessible to screen readers and Narrator. In WinUI 3 this
// is achieved by collapsing the element visually while keeping
// the automation name set for accessibility services.
//
// Adapts the visually-hidden.widget spec: anatomy (root),
// states (static), and connect attributes (data-part, style)
// to WinUI 3 rendering.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Primitives;

public sealed class ClefVisuallyHidden : UserControl
{
    public static readonly DependencyProperty TextProperty =
        DependencyProperty.Register(nameof(Text), typeof(string), typeof(ClefVisuallyHidden),
            new PropertyMetadata(null, OnPropertyChanged));

    public string Text { get => (string)GetValue(TextProperty); set => SetValue(TextProperty, value); }

    private readonly Border _container;

    public ClefVisuallyHidden()
    {
        _container = new Border
        {
            Width = 0,
            Height = 0,
            Opacity = 0
        };
        Content = _container;
        UpdateVisual();
    }

    public void SetHiddenContent(UIElement element)
    {
        _container.Child = element;
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefVisuallyHidden)d).UpdateVisual();

    private void UpdateVisual()
    {
        if (Text != null)
            AutomationProperties.SetName(_container, Text);
    }
}
