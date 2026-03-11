// ============================================================
// Clef Surface WinUI Widget — NotificationItem
//
// Single notification entry with icon, title, message, time,
// and read/unread state. Maps the notificationitem.widget spec
// to WinUI 3 StackPanel layout with visual indicators.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.DataDisplay;

public sealed class ClefNotificationItem : UserControl
{
    public static readonly DependencyProperty TitleProperty =
        DependencyProperty.Register(nameof(Title), typeof(string), typeof(ClefNotificationItem),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty MessageProperty =
        DependencyProperty.Register(nameof(Message), typeof(string), typeof(ClefNotificationItem),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty TimestampProperty =
        DependencyProperty.Register(nameof(Timestamp), typeof(string), typeof(ClefNotificationItem),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty IsReadProperty =
        DependencyProperty.Register(nameof(IsRead), typeof(bool), typeof(ClefNotificationItem),
            new PropertyMetadata(false, OnPropertyChanged));

    public string Title { get => (string)GetValue(TitleProperty); set => SetValue(TitleProperty, value); }
    public string Message { get => (string)GetValue(MessageProperty); set => SetValue(MessageProperty, value); }
    public string Timestamp { get => (string)GetValue(TimestampProperty); set => SetValue(TimestampProperty, value); }
    public bool IsRead { get => (bool)GetValue(IsReadProperty); set => SetValue(IsReadProperty, value); }

    public event RoutedEventHandler Click;

    private readonly Border _border;
    private readonly StackPanel _root;
    private readonly Ellipse _indicator;
    private readonly TextBlock _titleBlock;
    private readonly TextBlock _messageBlock;
    private readonly TextBlock _timeBlock;

    public ClefNotificationItem()
    {
        _indicator = new Microsoft.UI.Xaml.Shapes.Ellipse
        {
            Width = 8,
            Height = 8,
            Fill = new Microsoft.UI.Xaml.Media.SolidColorBrush(Microsoft.UI.Colors.CornflowerBlue),
            Margin = new Thickness(0, 4, 8, 0),
            VerticalAlignment = VerticalAlignment.Top
        };
        _titleBlock = new TextBlock { FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
        _messageBlock = new TextBlock { Opacity = 0.7, TextWrapping = TextWrapping.Wrap };
        _timeBlock = new TextBlock { FontSize = 11, Opacity = 0.5 };
        var textCol = new StackPanel { Spacing = 2 };
        textCol.Children.Add(_titleBlock);
        textCol.Children.Add(_messageBlock);
        textCol.Children.Add(_timeBlock);
        _root = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
        _root.Children.Add(_indicator);
        _root.Children.Add(textCol);
        _border = new Border { Padding = new Thickness(12, 8, 12, 8), Child = _root };
        _border.PointerPressed += (s, e) => Click?.Invoke(this, new RoutedEventArgs());
        Content = _border;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefNotificationItem)d).UpdateVisual();

    private void UpdateVisual()
    {
        _titleBlock.Text = Title ?? "";
        _messageBlock.Text = Message ?? "";
        _timeBlock.Text = Timestamp ?? "";
        _indicator.Visibility = IsRead ? Visibility.Collapsed : Visibility.Visible;
        _border.Background = IsRead
            ? null
            : new Microsoft.UI.Xaml.Media.SolidColorBrush(Microsoft.UI.Colors.AliceBlue);
    }
}
