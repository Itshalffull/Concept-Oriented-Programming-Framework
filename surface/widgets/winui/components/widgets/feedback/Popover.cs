// ============================================================
// Clef Surface WinUI Widget — Popover
//
// Non-modal floating content panel anchored to a trigger
// element. Displays supplementary information or controls.
//
// Adapts the popover.widget spec to WinUI 3 Flyout control.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Controls.Primitives;

namespace Clef.Surface.WinUI.Widgets.Feedback;

public sealed class ClefPopover : UserControl
{
    public static readonly DependencyProperty TitleProperty =
        DependencyProperty.Register(nameof(Title), typeof(string), typeof(ClefPopover),
            new PropertyMetadata(null));

    public static readonly DependencyProperty IsOpenProperty =
        DependencyProperty.Register(nameof(IsOpen), typeof(bool), typeof(ClefPopover),
            new PropertyMetadata(false, OnPropertyChanged));

    public string Title { get => (string)GetValue(TitleProperty); set => SetValue(TitleProperty, value); }
    public bool IsOpen { get => (bool)GetValue(IsOpenProperty); set => SetValue(IsOpenProperty, value); }

    public event System.EventHandler PopoverClosed;

    private readonly Grid _root;
    private readonly Flyout _flyout;
    private readonly StackPanel _flyoutContent;
    private readonly TextBlock _titleBlock;
    private readonly ContentPresenter _bodyPresenter;

    public ClefPopover()
    {
        _root = new Grid();
        _titleBlock = new TextBlock { FontWeight = Microsoft.UI.Text.FontWeights.SemiBold, Visibility = Visibility.Collapsed };
        _bodyPresenter = new ContentPresenter();
        _flyoutContent = new StackPanel { Spacing = 8, MinWidth = 200 };
        _flyoutContent.Children.Add(_titleBlock);
        _flyoutContent.Children.Add(_bodyPresenter);
        _flyout = new Flyout { Content = _flyoutContent };
        _flyout.Closed += (s, e) => { IsOpen = false; PopoverClosed?.Invoke(this, System.EventArgs.Empty); };
        Content = _root;
    }

    public void SetTrigger(UIElement trigger)
    {
        _root.Children.Clear();
        _root.Children.Add(trigger);
        FlyoutBase.SetAttachedFlyout(trigger, _flyout);
        if (trigger is Button btn)
            btn.Click += (s, e) => FlyoutBase.ShowAttachedFlyout(trigger);
    }

    public void SetPopoverContent(UIElement content)
    {
        _bodyPresenter.Content = content;
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        var popover = (ClefPopover)d;
        popover._titleBlock.Text = popover.Title ?? "";
        popover._titleBlock.Visibility = string.IsNullOrEmpty(popover.Title) ? Visibility.Collapsed : Visibility.Visible;
        if (popover.IsOpen && popover._root.Children.Count > 0)
            FlyoutBase.ShowAttachedFlyout(popover._root.Children[0]);
    }
}
