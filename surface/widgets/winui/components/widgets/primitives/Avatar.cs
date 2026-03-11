// ============================================================
// Clef Surface WinUI Widget — Avatar
//
// Displays a user or entity identity as initials inside a
// bordered circular surface. When no name is provided, falls
// back to a placeholder glyph. Size affects the diameter and
// text style.
//
// Adapts the avatar.widget spec: anatomy (root, image, fallback),
// states (loading, loaded, error), and connect attributes
// (data-part, data-size, data-state) to WinUI 3 rendering.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Shapes;
using Microsoft.UI;
using Windows.UI;

namespace Clef.Surface.WinUI.Widgets.Primitives;

public sealed class ClefAvatar : UserControl
{
    public static readonly DependencyProperty DisplayNameProperty =
        DependencyProperty.Register(nameof(DisplayName), typeof(string), typeof(ClefAvatar),
            new PropertyMetadata("", OnPropertyChanged));

    public static readonly DependencyProperty SizeProperty =
        DependencyProperty.Register(nameof(Size), typeof(string), typeof(ClefAvatar),
            new PropertyMetadata("md", OnPropertyChanged));

    public static readonly DependencyProperty FallbackTextProperty =
        DependencyProperty.Register(nameof(FallbackText), typeof(string), typeof(ClefAvatar),
            new PropertyMetadata(null, OnPropertyChanged));

    public string DisplayName { get => (string)GetValue(DisplayNameProperty); set => SetValue(DisplayNameProperty, value); }
    public string Size { get => (string)GetValue(SizeProperty); set => SetValue(SizeProperty, value); }
    public string FallbackText { get => (string)GetValue(FallbackTextProperty); set => SetValue(FallbackTextProperty, value); }

    private readonly Grid _root;
    private readonly Ellipse _background;
    private readonly TextBlock _initialsText;

    public ClefAvatar()
    {
        _root = new Grid();
        _background = new Ellipse
        {
            Fill = new SolidColorBrush(Colors.LightSlateGray),
            Stroke = new SolidColorBrush(Colors.Gray),
            StrokeThickness = 1
        };
        _initialsText = new TextBlock
        {
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center,
            FontWeight = Microsoft.UI.Text.FontWeights.Bold
        };
        _root.Children.Add(_background);
        _root.Children.Add(_initialsText);
        Content = _root;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefAvatar)d).UpdateVisual();

    private void UpdateVisual()
    {
        var (sizeDp, fontSp) = Size switch
        {
            "sm" => (32.0, 12.0),
            "lg" => (56.0, 20.0),
            _ => (40.0, 14.0)
        };
        _root.Width = sizeDp;
        _root.Height = sizeDp;
        _background.Width = sizeDp;
        _background.Height = sizeDp;
        _initialsText.FontSize = fontSp;
        _initialsText.Text = FallbackText ?? GetInitials(DisplayName);
    }

    private static string GetInitials(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return "?";
        var parts = name.Trim().Split(' ', System.StringSplitOptions.RemoveEmptyEntries);
        return parts.Length == 1
            ? parts[0][..1].ToUpper()
            : $"{char.ToUpper(parts[0][0])}{char.ToUpper(parts[^1][0])}";
    }
}
