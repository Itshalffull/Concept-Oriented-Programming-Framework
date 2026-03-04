// ============================================================
// Clef Surface WinUI Widget — NotificationCenter
//
// Aggregated notification panel with grouping, mark-all-read,
// and filter by type. Maps the notificationcenter.widget spec
// to WinUI 3 SplitView flyout with ListView.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Composites;

public sealed class ClefNotificationCenter : UserControl
{
    public static readonly DependencyProperty UnreadCountProperty =
        DependencyProperty.Register(nameof(UnreadCount), typeof(int), typeof(ClefNotificationCenter),
            new PropertyMetadata(0, OnPropertyChanged));

    public int UnreadCount { get => (int)GetValue(UnreadCountProperty); set => SetValue(UnreadCountProperty, value); }

    public event RoutedEventHandler MarkAllRead;
    public event System.EventHandler<object> NotificationClicked;

    private readonly StackPanel _root;
    private readonly StackPanel _header;
    private readonly TextBlock _titleBlock;
    private readonly Button _markAllBtn;
    private readonly ListView _list;

    public ClefNotificationCenter()
    {
        _titleBlock = new TextBlock { FontSize = 16, FontWeight = Microsoft.UI.Text.FontWeights.Bold };
        _markAllBtn = new Button { Content = "Mark all read" };
        _markAllBtn.Click += (s, e) => MarkAllRead?.Invoke(this, new RoutedEventArgs());
        _header = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 12 };
        _header.Children.Add(_titleBlock);
        _header.Children.Add(_markAllBtn);
        _list = new ListView { SelectionMode = ListViewSelectionMode.None };
        _list.ItemClick += (s, e) => NotificationClicked?.Invoke(this, e.ClickedItem);
        _list.IsItemClickEnabled = true;
        _root = new StackPanel { Spacing = 8, Padding = new Thickness(12) };
        _root.Children.Add(_header);
        _root.Children.Add(_list);
        Content = _root;
        UpdateVisual();
    }

    public void SetItemsSource(object source) => _list.ItemsSource = source;
    public void SetItemTemplate(DataTemplate template) => _list.ItemTemplate = template;

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefNotificationCenter)d).UpdateVisual();

    private void UpdateVisual()
    {
        _titleBlock.Text = UnreadCount > 0
            ? $"Notifications ({UnreadCount})"
            : "Notifications";
    }
}
