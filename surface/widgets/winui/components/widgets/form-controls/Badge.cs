// ============================================================
// Clef Surface WinUI Widget — Badge
//
// Compact status indicator or count display. Renders as a
// colored label with filled, outline, or subtle variants.
// Maps the badge.widget anatomy (root, label) to WinUI 3
// Border/TextBlock with color support.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using Windows.UI;

namespace Clef.Surface.WinUI.Widgets.FormControls;

public sealed class ClefBadge : UserControl
{
    public static readonly DependencyProperty TextProperty =
        DependencyProperty.Register(nameof(Text), typeof(string), typeof(ClefBadge),
            new PropertyMetadata("", OnPropertyChanged));

    public static readonly DependencyProperty VariantProperty =
        DependencyProperty.Register(nameof(Variant), typeof(string), typeof(ClefBadge),
            new PropertyMetadata("filled", OnPropertyChanged));

    public static readonly DependencyProperty SizeProperty =
        DependencyProperty.Register(nameof(Size), typeof(string), typeof(ClefBadge),
            new PropertyMetadata("md", OnPropertyChanged));

    public string Text { get => (string)GetValue(TextProperty); set => SetValue(TextProperty, value); }
    public string Variant { get => (string)GetValue(VariantProperty); set => SetValue(VariantProperty, value); }
    public string Size { get => (string)GetValue(SizeProperty); set => SetValue(SizeProperty, value); }

    private readonly Border _border;
    private readonly TextBlock _textBlock;

    public ClefBadge()
    {
        _textBlock = new TextBlock
        {
            FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center
        };
        _border = new Border
        {
            Child = _textBlock,
            CornerRadius = new CornerRadius(4)
        };
        Content = _border;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefBadge)d).UpdateVisual();

    private void UpdateVisual()
    {
        _textBlock.Text = Text;
        var (hPad, vPad, fontSize) = Size switch
        {
            "sm" => (4.0, 0.0, 10.0),
            "lg" => (12.0, 4.0, 14.0),
            _ => (8.0, 2.0, 12.0)
        };
        _border.Padding = new Thickness(hPad, vPad, hPad, vPad);
        _textBlock.FontSize = fontSize;

        var accentColor = Colors.CornflowerBlue;
        switch (Variant)
        {
            case "outline":
                _border.Background = new SolidColorBrush(Colors.Transparent);
                _border.BorderBrush = new SolidColorBrush(accentColor);
                _border.BorderThickness = new Thickness(1);
                _textBlock.Foreground = new SolidColorBrush(accentColor);
                break;
            case "subtle":
                _border.Background = new SolidColorBrush(Color.FromArgb(30, accentColor.R, accentColor.G, accentColor.B));
                _border.BorderThickness = new Thickness(0);
                _textBlock.Foreground = new SolidColorBrush(accentColor);
                break;
            default:
                _border.Background = new SolidColorBrush(accentColor);
                _border.BorderThickness = new Thickness(0);
                _textBlock.Foreground = new SolidColorBrush(Colors.White);
                break;
        }
    }
}
