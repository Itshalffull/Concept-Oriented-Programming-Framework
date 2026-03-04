// ============================================================
// Clef Surface WinUI Widget — Button
//
// Generic action trigger rendered using WinUI 3 Button controls.
// Supports filled, outline, text, and danger variants with
// disabled and loading states. A ProgressRing replaces the icon
// slot when loading.
//
// Adapts the button.widget spec: anatomy (root, label, icon,
// spinner), states (idle, hovered, focused, pressed, disabled,
// loading), and connect attributes (data-variant, data-size,
// data-state, role) to WinUI 3 rendering.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;

namespace Clef.Surface.WinUI.Widgets.Primitives;

public sealed class ClefButton : UserControl
{
    public static readonly DependencyProperty VariantProperty =
        DependencyProperty.Register(nameof(Variant), typeof(string), typeof(ClefButton),
            new PropertyMetadata("filled", OnPropertyChanged));

    public static readonly DependencyProperty SizeProperty =
        DependencyProperty.Register(nameof(Size), typeof(string), typeof(ClefButton),
            new PropertyMetadata("md", OnPropertyChanged));

    public static readonly DependencyProperty IsDisabledProperty =
        DependencyProperty.Register(nameof(IsDisabled), typeof(bool), typeof(ClefButton),
            new PropertyMetadata(false, OnPropertyChanged));

    public static readonly DependencyProperty IsLoadingProperty =
        DependencyProperty.Register(nameof(IsLoading), typeof(bool), typeof(ClefButton),
            new PropertyMetadata(false, OnPropertyChanged));

    public static readonly DependencyProperty LabelProperty =
        DependencyProperty.Register(nameof(Label), typeof(string), typeof(ClefButton),
            new PropertyMetadata("", OnPropertyChanged));

    public string Variant { get => (string)GetValue(VariantProperty); set => SetValue(VariantProperty, value); }
    public string Size { get => (string)GetValue(SizeProperty); set => SetValue(SizeProperty, value); }
    public bool IsDisabled { get => (bool)GetValue(IsDisabledProperty); set => SetValue(IsDisabledProperty, value); }
    public bool IsLoading { get => (bool)GetValue(IsLoadingProperty); set => SetValue(IsLoadingProperty, value); }
    public string Label { get => (string)GetValue(LabelProperty); set => SetValue(LabelProperty, value); }

    public event RoutedEventHandler Click;

    private readonly Button _button;
    private readonly StackPanel _contentPanel;
    private readonly ProgressRing _spinner;
    private readonly TextBlock _label;

    public ClefButton()
    {
        _spinner = new ProgressRing { IsActive = false, Width = 16, Height = 16 };
        _label = new TextBlock();
        _contentPanel = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            Spacing = 8
        };
        _contentPanel.Children.Add(_spinner);
        _contentPanel.Children.Add(_label);
        _button = new Button { Content = _contentPanel };
        _button.Click += (s, e) => Click?.Invoke(this, e);
        Content = _button;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefButton)d).UpdateVisual();

    private void UpdateVisual()
    {
        _button.IsEnabled = !IsDisabled && !IsLoading;
        _spinner.IsActive = IsLoading;
        _spinner.Visibility = IsLoading ? Visibility.Visible : Visibility.Collapsed;
        _label.Text = Label;

        var padding = Size switch
        {
            "sm" => new Thickness(8, 4, 8, 4),
            "lg" => new Thickness(24, 12, 24, 12),
            _ => new Thickness(16, 8, 16, 8)
        };
        _button.Padding = padding;

        switch (Variant)
        {
            case "outline":
                _button.Style = null;
                _button.BorderThickness = new Thickness(1);
                _button.Background = new SolidColorBrush(Colors.Transparent);
                break;
            case "text":
                _button.Style = null;
                _button.BorderThickness = new Thickness(0);
                _button.Background = new SolidColorBrush(Colors.Transparent);
                break;
            case "danger":
                _button.Background = new SolidColorBrush(Colors.Red);
                _button.Foreground = new SolidColorBrush(Colors.White);
                break;
            default:
                _button.Style = null;
                break;
        }

        AutomationProperties.SetName(_button, Label);
    }
}
