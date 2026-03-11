// ============================================================
// Clef Surface WinUI Widget — Checkbox
//
// Boolean toggle control rendered with WinUI 3 CheckBox.
// Supports checked, unchecked, and indeterminate states with
// an optional label and required-field indicator.
//
// Adapts the checkbox.widget spec: anatomy (root, input,
// control, indicator, label), states (unchecked, checked,
// indeterminate, disabled, focused), and connect attributes
// (data-part, data-state, data-disabled) to WinUI 3 rendering.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Primitives;

public sealed class ClefCheckbox : UserControl
{
    public static readonly DependencyProperty IsCheckedProperty =
        DependencyProperty.Register(nameof(IsChecked), typeof(bool?), typeof(ClefCheckbox),
            new PropertyMetadata(false, OnPropertyChanged));

    public static readonly DependencyProperty IsIndeterminateProperty =
        DependencyProperty.Register(nameof(IsIndeterminate), typeof(bool), typeof(ClefCheckbox),
            new PropertyMetadata(false, OnPropertyChanged));

    public static readonly DependencyProperty IsDisabledProperty =
        DependencyProperty.Register(nameof(IsDisabled), typeof(bool), typeof(ClefCheckbox),
            new PropertyMetadata(false, OnPropertyChanged));

    public static readonly DependencyProperty LabelProperty =
        DependencyProperty.Register(nameof(Label), typeof(string), typeof(ClefCheckbox),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty IsRequiredProperty =
        DependencyProperty.Register(nameof(IsRequired), typeof(bool), typeof(ClefCheckbox),
            new PropertyMetadata(false, OnPropertyChanged));

    public bool? IsChecked { get => (bool?)GetValue(IsCheckedProperty); set => SetValue(IsCheckedProperty, value); }
    public bool IsIndeterminate { get => (bool)GetValue(IsIndeterminateProperty); set => SetValue(IsIndeterminateProperty, value); }
    public bool IsDisabled { get => (bool)GetValue(IsDisabledProperty); set => SetValue(IsDisabledProperty, value); }
    public string Label { get => (string)GetValue(LabelProperty); set => SetValue(LabelProperty, value); }
    public bool IsRequired { get => (bool)GetValue(IsRequiredProperty); set => SetValue(IsRequiredProperty, value); }

    public event System.EventHandler<bool?> CheckedChanged;

    private readonly CheckBox _checkBox;

    public ClefCheckbox()
    {
        _checkBox = new CheckBox { IsThreeState = false };
        _checkBox.Checked += (s, e) => CheckedChanged?.Invoke(this, true);
        _checkBox.Unchecked += (s, e) => CheckedChanged?.Invoke(this, false);
        _checkBox.Indeterminate += (s, e) => CheckedChanged?.Invoke(this, null);
        Content = _checkBox;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefCheckbox)d).UpdateVisual();

    private void UpdateVisual()
    {
        _checkBox.IsEnabled = !IsDisabled;
        _checkBox.IsThreeState = IsIndeterminate;
        _checkBox.IsChecked = IsIndeterminate ? null : IsChecked;
        var labelText = Label ?? "";
        if (IsRequired && !string.IsNullOrEmpty(labelText))
            labelText += " *";
        _checkBox.Content = string.IsNullOrEmpty(labelText) ? null : labelText;
        AutomationProperties.SetName(_checkBox, Label ?? "Checkbox");
    }
}
