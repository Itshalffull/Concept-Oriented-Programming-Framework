// ============================================================
// Clef Surface WinUI Widget — Drawer
//
// Slide-in panel that overlays the page content. Functions as
// a modal surface with focus trapping. Supports placement on
// start or end edge with configurable width.
//
// Adapts the drawer.widget spec to WinUI 3 SplitView control.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Feedback;

public sealed class ClefDrawer : UserControl
{
    public static readonly DependencyProperty IsOpenProperty =
        DependencyProperty.Register(nameof(IsOpen), typeof(bool), typeof(ClefDrawer),
            new PropertyMetadata(false, OnPropertyChanged));

    public static readonly DependencyProperty TitleProperty =
        DependencyProperty.Register(nameof(Title), typeof(string), typeof(ClefDrawer),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty DrawerWidthProperty =
        DependencyProperty.Register(nameof(DrawerWidth), typeof(double), typeof(ClefDrawer),
            new PropertyMetadata(300.0, OnPropertyChanged));

    public static readonly DependencyProperty PositionProperty =
        DependencyProperty.Register(nameof(Position), typeof(string), typeof(ClefDrawer),
            new PropertyMetadata("end", OnPropertyChanged));

    public bool IsOpen { get => (bool)GetValue(IsOpenProperty); set => SetValue(IsOpenProperty, value); }
    public string Title { get => (string)GetValue(TitleProperty); set => SetValue(TitleProperty, value); }
    public double DrawerWidth { get => (double)GetValue(DrawerWidthProperty); set => SetValue(DrawerWidthProperty, value); }
    public string Position { get => (string)GetValue(PositionProperty); set => SetValue(PositionProperty, value); }

    public event RoutedEventHandler DrawerClosed;

    private readonly SplitView _splitView;
    private readonly StackPanel _paneContent;
    private readonly TextBlock _titleBlock;
    private readonly Button _closeBtn;
    private readonly ContentPresenter _drawerPresenter;
    private readonly ContentPresenter _mainPresenter;

    public ClefDrawer()
    {
        _titleBlock = new TextBlock { FontSize = 18, FontWeight = Microsoft.UI.Text.FontWeights.Bold };
        _closeBtn = new Button { Content = new SymbolIcon(Symbol.Cancel) };
        _closeBtn.Click += (s, e) => { IsOpen = false; DrawerClosed?.Invoke(this, new RoutedEventArgs()); };
        var header = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
        header.Children.Add(_titleBlock);
        header.Children.Add(_closeBtn);
        _drawerPresenter = new ContentPresenter();
        _paneContent = new StackPanel { Padding = new Thickness(16), Spacing = 8 };
        _paneContent.Children.Add(header);
        _paneContent.Children.Add(new Border { Height = 1, Background = new Microsoft.UI.Xaml.Media.SolidColorBrush(Microsoft.UI.Colors.Gray), HorizontalAlignment = HorizontalAlignment.Stretch });
        _paneContent.Children.Add(_drawerPresenter);
        _mainPresenter = new ContentPresenter();
        _splitView = new SplitView
        {
            Pane = _paneContent,
            Content = _mainPresenter,
            DisplayMode = SplitViewDisplayMode.Overlay,
            IsPaneOpen = false,
            OpenPaneLength = 300
        };
        _splitView.PaneClosed += (s, e) => { IsOpen = false; DrawerClosed?.Invoke(this, new RoutedEventArgs()); };
        Content = _splitView;
        UpdateVisual();
    }

    public void SetDrawerContent(UIElement element) => _drawerPresenter.Content = element;
    public void SetMainContent(UIElement element) => _mainPresenter.Content = element;

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefDrawer)d).UpdateVisual();

    private void UpdateVisual()
    {
        _splitView.IsPaneOpen = IsOpen;
        _splitView.OpenPaneLength = DrawerWidth;
        _splitView.PanePlacement = Position == "start" ? SplitViewPanePlacement.Left : SplitViewPanePlacement.Right;
        _titleBlock.Text = Title ?? "";
    }
}
