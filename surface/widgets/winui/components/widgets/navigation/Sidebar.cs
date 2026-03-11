// ============================================================
// Clef Surface WinUI Widget — Sidebar
//
// Persistent side panel for navigation or auxiliary content.
// Supports collapsible mode. Maps the sidebar.widget spec to
// WinUI 3 SplitView.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Navigation;

public sealed class ClefSidebar : UserControl
{
    public static readonly DependencyProperty IsOpenProperty =
        DependencyProperty.Register(nameof(IsOpen), typeof(bool), typeof(ClefSidebar),
            new PropertyMetadata(true, OnPropertyChanged));

    public static readonly DependencyProperty SidebarWidthProperty =
        DependencyProperty.Register(nameof(SidebarWidth), typeof(double), typeof(ClefSidebar),
            new PropertyMetadata(250.0, OnPropertyChanged));

    public static readonly DependencyProperty PositionProperty =
        DependencyProperty.Register(nameof(Position), typeof(string), typeof(ClefSidebar),
            new PropertyMetadata("start", OnPropertyChanged));

    public bool IsOpen { get => (bool)GetValue(IsOpenProperty); set => SetValue(IsOpenProperty, value); }
    public double SidebarWidth { get => (double)GetValue(SidebarWidthProperty); set => SetValue(SidebarWidthProperty, value); }
    public string Position { get => (string)GetValue(PositionProperty); set => SetValue(PositionProperty, value); }

    private readonly SplitView _splitView;
    private readonly ContentPresenter _sidebarContent;
    private readonly ContentPresenter _mainContent;

    public ClefSidebar()
    {
        _sidebarContent = new ContentPresenter();
        _mainContent = new ContentPresenter();
        _splitView = new SplitView
        {
            Pane = _sidebarContent,
            Content = _mainContent,
            DisplayMode = SplitViewDisplayMode.Inline,
            IsPaneOpen = true,
            OpenPaneLength = 250
        };
        Content = _splitView;
        UpdateVisual();
    }

    public void SetSidebarContent(UIElement element) => _sidebarContent.Content = element;
    public void SetMainContent(UIElement element) => _mainContent.Content = element;

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefSidebar)d).UpdateVisual();

    private void UpdateVisual()
    {
        _splitView.IsPaneOpen = IsOpen;
        _splitView.OpenPaneLength = SidebarWidth;
        _splitView.PanePlacement = Position == "end"
            ? SplitViewPanePlacement.Right
            : SplitViewPanePlacement.Left;
    }
}
