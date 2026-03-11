// ============================================================
// Clef Surface WinUI Widget — Select
//
// Dropdown single-choice selector. Maps the select.widget
// anatomy (root, label, trigger, valueDisplay, indicator,
// content, item) to WinUI 3 ComboBox.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Collections.Generic;
using System.Linq;

namespace Clef.Surface.WinUI.Widgets.FormControls;

public record SelectOption(string Label, string Value, bool Disabled = false);

public sealed class ClefSelect : UserControl
{
    public static readonly DependencyProperty LabelProperty =
        DependencyProperty.Register(nameof(Label), typeof(string), typeof(ClefSelect),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty PlaceholderProperty =
        DependencyProperty.Register(nameof(Placeholder), typeof(string), typeof(ClefSelect),
            new PropertyMetadata("Select..."));

    public static readonly DependencyProperty IsEnabledOverrideProperty =
        DependencyProperty.Register(nameof(IsEnabledOverride), typeof(bool), typeof(ClefSelect),
            new PropertyMetadata(true, OnPropertyChanged));

    public string Label { get => (string)GetValue(LabelProperty); set => SetValue(LabelProperty, value); }
    public string Placeholder { get => (string)GetValue(PlaceholderProperty); set => SetValue(PlaceholderProperty, value); }
    public bool IsEnabledOverride { get => (bool)GetValue(IsEnabledOverrideProperty); set => SetValue(IsEnabledOverrideProperty, value); }

    public event System.EventHandler<string> ValueChanged;

    private List<SelectOption> _options = new();
    private readonly StackPanel _root;
    private readonly TextBlock _labelBlock;
    private readonly ComboBox _comboBox;

    public ClefSelect()
    {
        _labelBlock = new TextBlock { Visibility = Visibility.Collapsed, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
        _comboBox = new ComboBox { PlaceholderText = "Select...", HorizontalAlignment = HorizontalAlignment.Stretch };
        _comboBox.SelectionChanged += (s, e) =>
        {
            if (_comboBox.SelectedIndex >= 0 && _comboBox.SelectedIndex < _options.Count)
                ValueChanged?.Invoke(this, _options[_comboBox.SelectedIndex].Value);
        };
        _root = new StackPanel { Spacing = 4 };
        _root.Children.Add(_labelBlock);
        _root.Children.Add(_comboBox);
        Content = _root;
    }

    public void SetOptions(List<SelectOption> options, string selectedValue = null)
    {
        _options = options;
        _comboBox.Items.Clear();
        foreach (var option in options)
            _comboBox.Items.Add(new ComboBoxItem { Content = option.Label, IsEnabled = !option.Disabled });
        if (selectedValue != null)
        {
            var idx = options.FindIndex(o => o.Value == selectedValue);
            if (idx >= 0) _comboBox.SelectedIndex = idx;
        }
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefSelect)d).UpdateVisual();

    private void UpdateVisual()
    {
        _labelBlock.Text = Label ?? "";
        _labelBlock.Visibility = string.IsNullOrEmpty(Label) ? Visibility.Collapsed : Visibility.Visible;
        _comboBox.IsEnabled = IsEnabledOverride;
        _comboBox.PlaceholderText = Placeholder;
        AutomationProperties.SetName(_comboBox, Label ?? "Select");
    }
}
