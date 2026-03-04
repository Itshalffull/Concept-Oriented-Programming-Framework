// ============================================================
// Clef Surface WinUI Widget — SegmentedControl
//
// Inline single-choice control displayed as a row of connected
// segments. The active segment is visually highlighted. Maps
// the segmented-control.widget anatomy to WinUI 3 StackPanel
// with ToggleButton segments.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Controls.Primitives;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System.Collections.Generic;

namespace Clef.Surface.WinUI.Widgets.FormControls;

public record SegmentedControlOption(string Label, string Value);

public sealed class ClefSegmentedControl : UserControl
{
    public static readonly DependencyProperty IsEnabledOverrideProperty =
        DependencyProperty.Register(nameof(IsEnabledOverride), typeof(bool), typeof(ClefSegmentedControl),
            new PropertyMetadata(true));

    public bool IsEnabledOverride { get => (bool)GetValue(IsEnabledOverrideProperty); set => SetValue(IsEnabledOverrideProperty, value); }

    public event System.EventHandler<string> ValueChanged;

    private List<SegmentedControlOption> _options = new();
    private string _selectedValue;
    private readonly StackPanel _root;

    public ClefSegmentedControl()
    {
        _root = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 0 };
        Content = new Border
        {
            Child = _root,
            BorderBrush = new SolidColorBrush(Colors.Gray),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(4)
        };
    }

    public void SetOptions(List<SegmentedControlOption> options, string selectedValue)
    {
        _options = options;
        _selectedValue = selectedValue;
        RebuildSegments();
    }

    private void RebuildSegments()
    {
        _root.Children.Clear();
        foreach (var option in _options)
        {
            var isSelected = option.Value == _selectedValue;
            var btn = new ToggleButton
            {
                Content = option.Label,
                IsChecked = isSelected,
                IsEnabled = IsEnabledOverride,
                Padding = new Thickness(16, 8, 16, 8),
                Background = new SolidColorBrush(isSelected ? Colors.CornflowerBlue : Colors.Transparent),
                Foreground = new SolidColorBrush(isSelected ? Colors.White : Colors.Black),
                BorderThickness = new Thickness(0)
            };
            var val = option.Value;
            btn.Click += (s, e) =>
            {
                _selectedValue = val;
                ValueChanged?.Invoke(this, val);
                RebuildSegments();
            };
            _root.Children.Add(btn);
        }
    }
}
