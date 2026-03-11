// ============================================================
// Clef Surface WinUI Widget — NotationBadge
//
// Small badge displaying the active diagram notation on a canvas
// toolbar. Shows notation name with tooltip. Clicking opens a
// notation selector. Maps the notation-badge.widget spec to a
// WinUI 3 Button control.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Domain;

public sealed class ClefNotationBadge : UserControl
{
    public static readonly DependencyProperty CanvasIdProperty =
        DependencyProperty.Register(nameof(CanvasId), typeof(string), typeof(ClefNotationBadge),
            new PropertyMetadata(""));

    public static readonly DependencyProperty NotationIdProperty =
        DependencyProperty.Register(nameof(NotationId), typeof(string), typeof(ClefNotationBadge),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty NotationNameProperty =
        DependencyProperty.Register(nameof(NotationName), typeof(string), typeof(ClefNotationBadge),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty NotationIconProperty =
        DependencyProperty.Register(nameof(NotationIcon), typeof(string), typeof(ClefNotationBadge),
            new PropertyMetadata(null, OnPropertyChanged));

    public string CanvasId { get => (string)GetValue(CanvasIdProperty); set => SetValue(CanvasIdProperty, value); }
    public string NotationId { get => (string)GetValue(NotationIdProperty); set => SetValue(NotationIdProperty, value); }
    public string NotationName { get => (string)GetValue(NotationNameProperty); set => SetValue(NotationNameProperty, value); }
    public string NotationIcon { get => (string)GetValue(NotationIconProperty); set => SetValue(NotationIconProperty, value); }

    public event System.EventHandler BadgeClicked;

    private readonly Button _button;
    private readonly FontIcon _icon;
    private readonly TextBlock _nameBlock;
    private readonly ToolTip _tooltip;

    public ClefNotationBadge()
    {
        _icon = new FontIcon
        {
            Glyph = "\uE943", // Diagram glyph
            FontSize = 12,
            Margin = new Thickness(0, 0, 6, 0)
        };

        _nameBlock = new TextBlock
        {
            FontSize = 12,
            VerticalAlignment = VerticalAlignment.Center
        };

        var content = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            Spacing = 4
        };
        content.Children.Add(_icon);
        content.Children.Add(_nameBlock);

        _button = new Button
        {
            Content = content,
            Padding = new Thickness(8, 4, 8, 4)
        };
        _button.Click += (s, e) => BadgeClicked?.Invoke(this, System.EventArgs.Empty);

        _tooltip = new ToolTip();
        ToolTipService.SetToolTip(_button, _tooltip);

        Content = _button;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefNotationBadge)d).UpdateVisual();

    private void UpdateVisual()
    {
        var displayName = string.IsNullOrEmpty(NotationName) ? "Freeform" : NotationName;
        _nameBlock.Text = displayName;
        _tooltip.Content = $"Notation: {displayName}";

        if (!string.IsNullOrEmpty(NotationIcon))
        {
            _icon.Glyph = NotationIcon;
        }

        AutomationProperties.SetName(_button, $"Notation: {displayName}");
    }
}
