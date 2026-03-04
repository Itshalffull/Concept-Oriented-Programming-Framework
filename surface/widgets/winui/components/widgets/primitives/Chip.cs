// ============================================================
// Clef Surface WinUI Widget — Chip
//
// Compact interactive tag element. Supports filled and outline
// variants, selection toggle, and an optional dismiss action.
//
// Adapts the chip.widget spec: anatomy (root, label,
// deleteButton, icon), states (idle, selected, hovered, focused,
// removed, deletable, disabled), and connect attributes to
// WinUI 3 rendering.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;

namespace Clef.Surface.WinUI.Widgets.Primitives;

public sealed class ClefChip : UserControl
{
    public static readonly DependencyProperty LabelProperty =
        DependencyProperty.Register(nameof(Label), typeof(string), typeof(ClefChip),
            new PropertyMetadata("", OnPropertyChanged));

    public static readonly DependencyProperty VariantProperty =
        DependencyProperty.Register(nameof(Variant), typeof(string), typeof(ClefChip),
            new PropertyMetadata("filled", OnPropertyChanged));

    public static readonly DependencyProperty IsSelectedProperty =
        DependencyProperty.Register(nameof(IsSelected), typeof(bool), typeof(ClefChip),
            new PropertyMetadata(false, OnPropertyChanged));

    public static readonly DependencyProperty IsDisabledProperty =
        DependencyProperty.Register(nameof(IsDisabled), typeof(bool), typeof(ClefChip),
            new PropertyMetadata(false, OnPropertyChanged));

    public static readonly DependencyProperty IsRemovableProperty =
        DependencyProperty.Register(nameof(IsRemovable), typeof(bool), typeof(ClefChip),
            new PropertyMetadata(false, OnPropertyChanged));

    public string Label { get => (string)GetValue(LabelProperty); set => SetValue(LabelProperty, value); }
    public string Variant { get => (string)GetValue(VariantProperty); set => SetValue(VariantProperty, value); }
    public bool IsSelected { get => (bool)GetValue(IsSelectedProperty); set => SetValue(IsSelectedProperty, value); }
    public bool IsDisabled { get => (bool)GetValue(IsDisabledProperty); set => SetValue(IsDisabledProperty, value); }
    public bool IsRemovable { get => (bool)GetValue(IsRemovableProperty); set => SetValue(IsRemovableProperty, value); }

    public event RoutedEventHandler SelectToggled;
    public event RoutedEventHandler RemoveClicked;

    private readonly Border _border;
    private readonly StackPanel _panel;
    private readonly TextBlock _labelText;
    private readonly Button _removeButton;

    public ClefChip()
    {
        _labelText = new TextBlock { VerticalAlignment = VerticalAlignment.Center };
        _removeButton = new Button
        {
            Content = new SymbolIcon(Symbol.Cancel),
            Padding = new Thickness(2),
            Background = new SolidColorBrush(Colors.Transparent),
            Visibility = Visibility.Collapsed
        };
        _removeButton.Click += (s, e) => { if (!IsDisabled) RemoveClicked?.Invoke(this, e); };
        _panel = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
        _panel.Children.Add(_labelText);
        _panel.Children.Add(_removeButton);
        _border = new Border
        {
            Child = _panel,
            Padding = new Thickness(8, 4, 8, 4),
            CornerRadius = new CornerRadius(16)
        };
        _border.PointerPressed += (s, e) => { if (!IsDisabled) SelectToggled?.Invoke(this, new RoutedEventArgs()); };
        Content = _border;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefChip)d).UpdateVisual();

    private void UpdateVisual()
    {
        _labelText.Text = Label;
        _removeButton.Visibility = IsRemovable ? Visibility.Visible : Visibility.Collapsed;
        _border.Opacity = IsDisabled ? 0.38 : 1.0;
        _border.Background = Variant == "outline"
            ? new SolidColorBrush(Colors.Transparent)
            : new SolidColorBrush(IsSelected ? Colors.CornflowerBlue : Colors.LightGray);
        _border.BorderBrush = new SolidColorBrush(IsSelected ? Colors.CornflowerBlue : Colors.Gray);
        _border.BorderThickness = new Thickness(1);
        AutomationProperties.SetName(_border, Label);
    }
}
