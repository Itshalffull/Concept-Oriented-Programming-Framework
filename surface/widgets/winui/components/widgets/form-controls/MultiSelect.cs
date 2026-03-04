// ============================================================
// Clef Surface WinUI Widget — MultiSelect
//
// Dropdown multi-choice selector. Displays a trigger showing
// the count of selected items with a dropdown containing
// checkbox-style items. Maps the multi-select.widget anatomy
// to WinUI 3 ComboBox with CheckBox items.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Collections.Generic;
using System.Linq;

namespace Clef.Surface.WinUI.Widgets.FormControls;

public record MultiSelectOption(string Label, string Value, bool Disabled = false);

public sealed class ClefMultiSelect : UserControl
{
    public static readonly DependencyProperty LabelProperty =
        DependencyProperty.Register(nameof(Label), typeof(string), typeof(ClefMultiSelect),
            new PropertyMetadata(null, OnPropertyChanged));

    public string Label { get => (string)GetValue(LabelProperty); set => SetValue(LabelProperty, value); }

    public event System.EventHandler<List<string>> ValueChanged;

    private List<MultiSelectOption> _options = new();
    private List<string> _selectedValues = new();
    private readonly StackPanel _root;
    private readonly TextBlock _labelBlock;
    private readonly DropDownButton _trigger;
    private readonly Flyout _flyout;
    private readonly StackPanel _flyoutPanel;

    public ClefMultiSelect()
    {
        _labelBlock = new TextBlock { Visibility = Visibility.Collapsed, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
        _flyoutPanel = new StackPanel { Spacing = 4, MinWidth = 200 };
        _flyout = new Flyout { Content = _flyoutPanel };
        _trigger = new DropDownButton { Content = "Select...", Flyout = _flyout };
        _root = new StackPanel { Spacing = 4 };
        _root.Children.Add(_labelBlock);
        _root.Children.Add(_trigger);
        Content = _root;
    }

    public void SetOptions(List<MultiSelectOption> options, List<string> selectedValues)
    {
        _options = options;
        _selectedValues = selectedValues.ToList();
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefMultiSelect)d).UpdateVisual();

    private void UpdateVisual()
    {
        _labelBlock.Text = Label ?? "";
        _labelBlock.Visibility = string.IsNullOrEmpty(Label) ? Visibility.Collapsed : Visibility.Visible;
        _trigger.Content = _selectedValues.Count switch
        {
            0 => "Select...",
            1 => _options.FirstOrDefault(o => o.Value == _selectedValues[0])?.Label ?? _selectedValues[0],
            _ => $"{_selectedValues.Count} selected"
        };
        _flyoutPanel.Children.Clear();
        foreach (var option in _options)
        {
            var cb = new CheckBox
            {
                Content = option.Label,
                IsChecked = _selectedValues.Contains(option.Value),
                IsEnabled = !option.Disabled
            };
            var val = option.Value;
            cb.Checked += (s, e) => { if (!_selectedValues.Contains(val)) _selectedValues.Add(val); OnSelectionChanged(); };
            cb.Unchecked += (s, e) => { _selectedValues.Remove(val); OnSelectionChanged(); };
            _flyoutPanel.Children.Add(cb);
        }
    }

    private void OnSelectionChanged()
    {
        _trigger.Content = _selectedValues.Count switch
        {
            0 => "Select...",
            1 => _options.FirstOrDefault(o => o.Value == _selectedValues[0])?.Label ?? _selectedValues[0],
            _ => $"{_selectedValues.Count} selected"
        };
        ValueChanged?.Invoke(this, _selectedValues.ToList());
    }
}
