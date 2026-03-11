// ============================================================
// Clef Surface WinUI Widget — Card
//
// Contained surface for grouping related content with optional
// header, body, and footer sections. Maps the card.widget spec
// to WinUI 3 Border with StackPanel layout.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.DataDisplay;

public sealed class ClefCard : UserControl
{
    public static readonly DependencyProperty TitleProperty =
        DependencyProperty.Register(nameof(Title), typeof(string), typeof(ClefCard),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty DescriptionProperty =
        DependencyProperty.Register(nameof(Description), typeof(string), typeof(ClefCard),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty IsClickableProperty =
        DependencyProperty.Register(nameof(IsClickable), typeof(bool), typeof(ClefCard),
            new PropertyMetadata(false));

    public string Title { get => (string)GetValue(TitleProperty); set => SetValue(TitleProperty, value); }
    public string Description { get => (string)GetValue(DescriptionProperty); set => SetValue(DescriptionProperty, value); }
    public bool IsClickable { get => (bool)GetValue(IsClickableProperty); set => SetValue(IsClickableProperty, value); }

    public event RoutedEventHandler Click;

    private readonly Border _border;
    private readonly StackPanel _root;
    private readonly TextBlock _titleBlock;
    private readonly TextBlock _descBlock;
    private readonly ContentPresenter _body;

    public ClefCard()
    {
        _titleBlock = new TextBlock
        {
            FontSize = 16,
            FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
            Visibility = Visibility.Collapsed
        };
        _descBlock = new TextBlock
        {
            Opacity = 0.7,
            TextWrapping = TextWrapping.Wrap,
            Visibility = Visibility.Collapsed
        };
        _body = new ContentPresenter();
        _root = new StackPanel { Spacing = 8 };
        _root.Children.Add(_titleBlock);
        _root.Children.Add(_descBlock);
        _root.Children.Add(_body);
        _border = new Border
        {
            BorderThickness = new Thickness(1),
            BorderBrush = new Microsoft.UI.Xaml.Media.SolidColorBrush(Microsoft.UI.Colors.LightGray),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(16),
            Child = _root
        };
        _border.PointerPressed += (s, e) => { if (IsClickable) Click?.Invoke(this, new RoutedEventArgs()); };
        Content = _border;
        UpdateVisual();
    }

    public void SetBody(UIElement element) => _body.Content = element;

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefCard)d).UpdateVisual();

    private void UpdateVisual()
    {
        _titleBlock.Text = Title ?? "";
        _titleBlock.Visibility = string.IsNullOrEmpty(Title) ? Visibility.Collapsed : Visibility.Visible;
        _descBlock.Text = Description ?? "";
        _descBlock.Visibility = string.IsNullOrEmpty(Description) ? Visibility.Collapsed : Visibility.Visible;
    }
}
