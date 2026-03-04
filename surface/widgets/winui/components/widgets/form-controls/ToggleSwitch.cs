// ============================================================
// Clef Surface WinUI Widget — ToggleSwitch
//
// Binary on/off toggle control. Renders a WinUI 3 ToggleSwitch
// with an optional label. Maps the toggle-switch.widget anatomy
// (root, input, control, thumb, label) to WinUI 3 ToggleSwitch.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.FormControls;

public sealed class ClefToggleSwitch : UserControl
{
    public static readonly DependencyProperty IsOnProperty =
        DependencyProperty.Register(nameof(IsOn), typeof(bool), typeof(ClefToggleSwitch),
            new PropertyMetadata(false, OnPropertyChanged));

    public static readonly DependencyProperty LabelProperty =
        DependencyProperty.Register(nameof(Label), typeof(string), typeof(ClefToggleSwitch),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty IsEnabledOverrideProperty =
        DependencyProperty.Register(nameof(IsEnabledOverride), typeof(bool), typeof(ClefToggleSwitch),
            new PropertyMetadata(true, OnPropertyChanged));

    public bool IsOn { get => (bool)GetValue(IsOnProperty); set => SetValue(IsOnProperty, value); }
    public string Label { get => (string)GetValue(LabelProperty); set => SetValue(LabelProperty, value); }
    public bool IsEnabledOverride { get => (bool)GetValue(IsEnabledOverrideProperty); set => SetValue(IsEnabledOverrideProperty, value); }

    public event System.EventHandler<bool> Toggled;

    private readonly ToggleSwitch _toggle;

    public ClefToggleSwitch()
    {
        _toggle = new ToggleSwitch();
        _toggle.Toggled += (s, e) => { IsOn = _toggle.IsOn; Toggled?.Invoke(this, _toggle.IsOn); };
        Content = _toggle;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefToggleSwitch)d).UpdateVisual();

    private void UpdateVisual()
    {
        _toggle.IsOn = IsOn;
        _toggle.IsEnabled = IsEnabledOverride;
        _toggle.Header = Label;
        AutomationProperties.SetName(_toggle, Label ?? "Toggle switch");
    }
}
