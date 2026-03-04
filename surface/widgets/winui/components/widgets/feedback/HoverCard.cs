// ============================================================
// Clef Surface WinUI Widget — HoverCard
//
// Preview card that displays richer content when triggered.
// Shown on pointer hover and controlled via the visible prop.
//
// Adapts the hover-card.widget spec to WinUI 3 Flyout.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Controls.Primitives;

namespace Clef.Surface.WinUI.Widgets.Feedback;

public sealed class ClefHoverCard : UserControl
{
    public static readonly DependencyProperty IsVisibleOverrideProperty =
        DependencyProperty.Register(nameof(IsVisibleOverride), typeof(bool), typeof(ClefHoverCard),
            new PropertyMetadata(false, OnPropertyChanged));

    public bool IsVisibleOverride { get => (bool)GetValue(IsVisibleOverrideProperty); set => SetValue(IsVisibleOverrideProperty, value); }

    public event System.EventHandler Dismissed;

    private readonly Grid _root;
    private readonly Flyout _flyout;
    private readonly ContentPresenter _cardPresenter;

    public ClefHoverCard()
    {
        _root = new Grid();
        _cardPresenter = new ContentPresenter();
        _flyout = new Flyout { Content = _cardPresenter };
        _flyout.Closed += (s, e) => Dismissed?.Invoke(this, System.EventArgs.Empty);
        Content = _root;
    }

    public void SetTrigger(UIElement trigger)
    {
        _root.Children.Clear();
        _root.Children.Add(trigger);
        FlyoutBase.SetAttachedFlyout(trigger, _flyout);
        trigger.PointerEntered += (s, e) => FlyoutBase.ShowAttachedFlyout(trigger);
    }

    public void SetCardContent(UIElement content)
    {
        _cardPresenter.Content = content;
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        var card = (ClefHoverCard)d;
        if (card.IsVisibleOverride && card._root.Children.Count > 0)
        {
            FlyoutBase.ShowAttachedFlyout(card._root.Children[0]);
        }
    }
}
