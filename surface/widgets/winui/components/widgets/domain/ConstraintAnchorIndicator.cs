// ============================================================
// Clef Surface WinUI Widget — ConstraintAnchorIndicator
//
// Canvas-based overlay for ConstraintAnchor visuals. Shows pin
// icons for pinned items, alignment lines for aligned groups,
// and separation arrows for gap constraints. Maps the
// constraint-anchor-indicator.widget spec to WinUI 3 Canvas.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Shapes;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;

namespace Clef.Surface.WinUI.Widgets.Domain;

public sealed class ClefConstraintAnchorIndicator : UserControl
{
    public static readonly DependencyProperty AnchorIdProperty =
        DependencyProperty.Register(nameof(AnchorId), typeof(string), typeof(ClefConstraintAnchorIndicator),
            new PropertyMetadata(""));

    public static readonly DependencyProperty AnchorTypeProperty =
        DependencyProperty.Register(nameof(AnchorType), typeof(string), typeof(ClefConstraintAnchorIndicator),
            new PropertyMetadata("pin", OnPropertyChanged));

    public static readonly DependencyProperty TargetCountProperty =
        DependencyProperty.Register(nameof(TargetCount), typeof(int), typeof(ClefConstraintAnchorIndicator),
            new PropertyMetadata(0, OnPropertyChanged));

    public static readonly DependencyProperty IsSelectedProperty =
        DependencyProperty.Register(nameof(IsSelected), typeof(bool), typeof(ClefConstraintAnchorIndicator),
            new PropertyMetadata(false, OnPropertyChanged));

    public static readonly DependencyProperty ConstraintXProperty =
        DependencyProperty.Register(nameof(ConstraintX), typeof(double), typeof(ClefConstraintAnchorIndicator),
            new PropertyMetadata(0.0));

    public static readonly DependencyProperty ConstraintYProperty =
        DependencyProperty.Register(nameof(ConstraintY), typeof(double), typeof(ClefConstraintAnchorIndicator),
            new PropertyMetadata(0.0));

    public static readonly DependencyProperty GapProperty =
        DependencyProperty.Register(nameof(Gap), typeof(double), typeof(ClefConstraintAnchorIndicator),
            new PropertyMetadata(0.0));

    public string AnchorId { get => (string)GetValue(AnchorIdProperty); set => SetValue(AnchorIdProperty, value); }
    public string AnchorType { get => (string)GetValue(AnchorTypeProperty); set => SetValue(AnchorTypeProperty, value); }
    public int TargetCount { get => (int)GetValue(TargetCountProperty); set => SetValue(TargetCountProperty, value); }
    public bool IsSelected { get => (bool)GetValue(IsSelectedProperty); set => SetValue(IsSelectedProperty, value); }
    public double ConstraintX { get => (double)GetValue(ConstraintXProperty); set => SetValue(ConstraintXProperty, value); }
    public double ConstraintY { get => (double)GetValue(ConstraintYProperty); set => SetValue(ConstraintYProperty, value); }
    public double Gap { get => (double)GetValue(GapProperty); set => SetValue(GapProperty, value); }

    public event System.EventHandler Selected;
    public event System.EventHandler DeleteRequested;

    private readonly Canvas _canvas;
    private readonly FontIcon _pinIcon;
    private readonly Line _alignmentLine;
    private readonly Line _separationArrow;

    public ClefConstraintAnchorIndicator()
    {
        _pinIcon = new FontIcon
        {
            Glyph = "\uE718", // Pin glyph
            FontSize = 16,
            Foreground = new SolidColorBrush(Colors.OrangeRed),
            Visibility = Visibility.Collapsed
        };

        _alignmentLine = new Line
        {
            Stroke = new SolidColorBrush(Colors.CornflowerBlue),
            StrokeThickness = 1,
            StrokeDashArray = new DoubleCollection { 4, 2 },
            Visibility = Visibility.Collapsed
        };

        _separationArrow = new Line
        {
            Stroke = new SolidColorBrush(Colors.MediumPurple),
            StrokeThickness = 2,
            Visibility = Visibility.Collapsed
        };

        _canvas = new Canvas
        {
            MinWidth = 24,
            MinHeight = 24,
            IsHitTestVisible = true
        };
        _canvas.Children.Add(_pinIcon);
        _canvas.Children.Add(_alignmentLine);
        _canvas.Children.Add(_separationArrow);

        _canvas.PointerEntered += (s, e) => SetHighlight(true);
        _canvas.PointerExited += (s, e) => { if (!IsSelected) SetHighlight(false); };
        _canvas.PointerPressed += (s, e) =>
        {
            IsSelected = true;
            Selected?.Invoke(this, System.EventArgs.Empty);
        };

        Content = _canvas;
        UpdateVisual();
    }

    private void SetHighlight(bool highlight)
    {
        _canvas.Opacity = highlight ? 1.0 : 0.7;
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefConstraintAnchorIndicator)d).UpdateVisual();

    private void UpdateVisual()
    {
        _pinIcon.Visibility = Visibility.Collapsed;
        _alignmentLine.Visibility = Visibility.Collapsed;
        _separationArrow.Visibility = Visibility.Collapsed;

        switch (AnchorType)
        {
            case "pin":
                _pinIcon.Visibility = Visibility.Visible;
                Canvas.SetLeft(_pinIcon, ConstraintX);
                Canvas.SetTop(_pinIcon, ConstraintY);
                break;

            case "align_h":
                _alignmentLine.Visibility = Visibility.Visible;
                _alignmentLine.X1 = 0;
                _alignmentLine.Y1 = ConstraintY;
                _alignmentLine.X2 = _canvas.ActualWidth > 0 ? _canvas.ActualWidth : 400;
                _alignmentLine.Y2 = ConstraintY;
                break;

            case "align_v":
                _alignmentLine.Visibility = Visibility.Visible;
                _alignmentLine.X1 = ConstraintX;
                _alignmentLine.Y1 = 0;
                _alignmentLine.X2 = ConstraintX;
                _alignmentLine.Y2 = _canvas.ActualHeight > 0 ? _canvas.ActualHeight : 400;
                break;

            case "separate":
                _separationArrow.Visibility = Visibility.Visible;
                _separationArrow.X1 = ConstraintX;
                _separationArrow.Y1 = ConstraintY;
                _separationArrow.X2 = ConstraintX + Gap;
                _separationArrow.Y2 = ConstraintY;
                break;
        }

        var borderColor = IsSelected ? Colors.CornflowerBlue : Colors.Transparent;
        _canvas.Opacity = IsSelected ? 1.0 : 0.7;

        AutomationProperties.SetName(_canvas, $"{AnchorType} constraint on {TargetCount} items");
    }
}
