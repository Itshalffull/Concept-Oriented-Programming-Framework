// ============================================================
// Clef Surface WinUI Widget — ColorPicker
//
// Color selection control with spectrum, hue slider, and hex
// input. Maps the colorpicker.widget spec to WinUI 3
// ColorPicker control.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.UI;

namespace Clef.Surface.WinUI.Widgets.ComplexInputs;

public sealed class ClefColorPicker : UserControl
{
    public static readonly DependencyProperty ColorProperty =
        DependencyProperty.Register(nameof(Color), typeof(Color), typeof(ClefColorPicker),
            new PropertyMetadata(Microsoft.UI.Colors.White, OnPropertyChanged));

    public static readonly DependencyProperty IsAlphaEnabledProperty =
        DependencyProperty.Register(nameof(IsAlphaEnabled), typeof(bool), typeof(ClefColorPicker),
            new PropertyMetadata(false, OnPropertyChanged));

    public Color Color { get => (Color)GetValue(ColorProperty); set => SetValue(ColorProperty, value); }
    public bool IsAlphaEnabled { get => (bool)GetValue(IsAlphaEnabledProperty); set => SetValue(IsAlphaEnabledProperty, value); }

    public event System.EventHandler<Color> ColorChanged;

    private readonly ColorPicker _picker;

    public ClefColorPicker()
    {
        _picker = new ColorPicker { IsColorSpectrumVisible = true, IsColorSliderVisible = true };
        _picker.ColorChanged += (s, e) =>
        {
            Color = e.NewColor;
            ColorChanged?.Invoke(this, e.NewColor);
        };
        Content = _picker;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefColorPicker)d).UpdateVisual();

    private void UpdateVisual()
    {
        _picker.Color = Color;
        _picker.IsAlphaEnabled = IsAlphaEnabled;
    }
}
