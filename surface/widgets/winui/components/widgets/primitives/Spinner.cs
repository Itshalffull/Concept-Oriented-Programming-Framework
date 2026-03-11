// ============================================================
// Clef Surface WinUI Widget — Spinner
//
// Indeterminate loading indicator rendered with WinUI 3
// ProgressRing. An optional label is displayed alongside the
// spinner. Size affects the indicator diameter.
//
// Adapts the spinner.widget spec: anatomy (root, track,
// indicator, label), states (spinning), and connect attributes
// (data-part, data-size, role, aria-busy, aria-label) to
// WinUI 3 rendering.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Primitives;

public sealed class ClefSpinner : UserControl
{
    public static readonly DependencyProperty SizeProperty =
        DependencyProperty.Register(nameof(Size), typeof(string), typeof(ClefSpinner),
            new PropertyMetadata("md", OnPropertyChanged));

    public static readonly DependencyProperty LabelProperty =
        DependencyProperty.Register(nameof(Label), typeof(string), typeof(ClefSpinner),
            new PropertyMetadata(null, OnPropertyChanged));

    public string Size { get => (string)GetValue(SizeProperty); set => SetValue(SizeProperty, value); }
    public string Label { get => (string)GetValue(LabelProperty); set => SetValue(LabelProperty, value); }

    private readonly StackPanel _root;
    private readonly ProgressRing _ring;
    private readonly TextBlock _labelText;

    public ClefSpinner()
    {
        _ring = new ProgressRing { IsActive = true };
        _labelText = new TextBlock { VerticalAlignment = VerticalAlignment.Center };
        _root = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
        _root.Children.Add(_ring);
        _root.Children.Add(_labelText);
        Content = _root;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefSpinner)d).UpdateVisual();

    private void UpdateVisual()
    {
        var sizePx = Size switch { "sm" => 16.0, "lg" => 48.0, _ => 24.0 };
        _ring.Width = sizePx;
        _ring.Height = sizePx;
        _labelText.Text = Label ?? "";
        _labelText.Visibility = string.IsNullOrEmpty(Label) ? Visibility.Collapsed : Visibility.Visible;
        AutomationProperties.SetName(_ring, Label ?? "Loading");
    }
}
