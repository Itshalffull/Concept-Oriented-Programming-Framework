// ============================================================
// Clef Surface WinUI Widget — CheckboxGroup
//
// Multi-choice selection from a visible list of checkboxes.
// Renders WinUI 3 CheckBox components in a StackPanel layout.
// Maps the checkbox-group.widget anatomy (root, label, items,
// item, itemControl, itemLabel) to WinUI 3 CheckBox controls.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Collections.Generic;
using System.Linq;

namespace Clef.Surface.WinUI.Widgets.FormControls;

public record CheckboxGroupOption(string Label, string Value, bool Disabled = false);

public sealed class ClefCheckboxGroup : UserControl
{
    public static readonly DependencyProperty LabelProperty =
        DependencyProperty.Register(nameof(Label), typeof(string), typeof(ClefCheckboxGroup),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty OrientationProperty =
        DependencyProperty.Register(nameof(Orientation), typeof(string), typeof(ClefCheckboxGroup),
            new PropertyMetadata("vertical", OnPropertyChanged));

    public static readonly DependencyProperty IsEnabledOverrideProperty =
        DependencyProperty.Register(nameof(IsEnabledOverride), typeof(bool), typeof(ClefCheckboxGroup),
            new PropertyMetadata(true, OnPropertyChanged));

    public string Label { get => (string)GetValue(LabelProperty); set => SetValue(LabelProperty, value); }
    public string Orientation { get => (string)GetValue(OrientationProperty); set => SetValue(OrientationProperty, value); }
    public bool IsEnabledOverride { get => (bool)GetValue(IsEnabledOverrideProperty); set => SetValue(IsEnabledOverrideProperty, value); }

    public event System.EventHandler<List<string>> ValueChanged;

    private List<string> _value = new();
    private List<CheckboxGroupOption> _options = new();
    private readonly StackPanel _root;
    private readonly TextBlock _labelBlock;
    private readonly StackPanel _itemsPanel;

    public ClefCheckboxGroup()
    {
        _labelBlock = new TextBlock { Visibility = Visibility.Collapsed, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
        _itemsPanel = new StackPanel();
        _root = new StackPanel { Spacing = 4 };
        _root.Children.Add(_labelBlock);
        _root.Children.Add(_itemsPanel);
        Content = _root;
    }

    public void SetOptions(List<CheckboxGroupOption> options, List<string> value)
    {
        _options = options;
        _value = value;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefCheckboxGroup)d).UpdateVisual();

    private void UpdateVisual()
    {
        _labelBlock.Text = Label ?? "";
        _labelBlock.Visibility = string.IsNullOrEmpty(Label) ? Visibility.Collapsed : Visibility.Visible;
        _itemsPanel.Orientation = Orientation == "horizontal"
            ? Microsoft.UI.Xaml.Controls.Orientation.Horizontal
            : Microsoft.UI.Xaml.Controls.Orientation.Vertical;
        _itemsPanel.Spacing = Orientation == "horizontal" ? 16 : 4;
        _itemsPanel.Children.Clear();

        foreach (var option in _options)
        {
            var cb = new CheckBox
            {
                Content = option.Label,
                IsChecked = _value.Contains(option.Value),
                IsEnabled = IsEnabledOverride && !option.Disabled
            };
            var optionValue = option.Value;
            cb.Checked += (s, e) =>
            {
                if (!_value.Contains(optionValue)) _value.Add(optionValue);
                ValueChanged?.Invoke(this, _value.ToList());
            };
            cb.Unchecked += (s, e) =>
            {
                _value.Remove(optionValue);
                ValueChanged?.Invoke(this, _value.ToList());
            };
            _itemsPanel.Children.Add(cb);
        }
    }
}
