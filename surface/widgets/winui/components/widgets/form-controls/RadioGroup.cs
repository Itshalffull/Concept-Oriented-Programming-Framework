// ============================================================
// Clef Surface WinUI Widget — RadioGroup
//
// Single-choice selection from a visible list of radio options.
// Maps the radio-group.widget anatomy (root, label, items,
// item, itemControl, itemLabel) to WinUI 3 RadioButtons control.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Collections.Generic;

namespace Clef.Surface.WinUI.Widgets.FormControls;

public record RadioGroupOption(string Label, string Value, bool Disabled = false);

public sealed class ClefRadioGroup : UserControl
{
    public static readonly DependencyProperty LabelProperty =
        DependencyProperty.Register(nameof(Label), typeof(string), typeof(ClefRadioGroup),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty OrientationProperty =
        DependencyProperty.Register(nameof(Orientation), typeof(string), typeof(ClefRadioGroup),
            new PropertyMetadata("vertical", OnPropertyChanged));

    public string Label { get => (string)GetValue(LabelProperty); set => SetValue(LabelProperty, value); }
    public string Orientation { get => (string)GetValue(OrientationProperty); set => SetValue(OrientationProperty, value); }

    public event System.EventHandler<string> ValueChanged;

    private List<RadioGroupOption> _options = new();
    private string _selectedValue;
    private readonly StackPanel _root;
    private readonly TextBlock _labelBlock;
    private readonly RadioButtons _radioButtons;

    public ClefRadioGroup()
    {
        _labelBlock = new TextBlock { Visibility = Visibility.Collapsed, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
        _radioButtons = new RadioButtons();
        _radioButtons.SelectionChanged += OnSelectionChanged;
        _root = new StackPanel { Spacing = 4 };
        _root.Children.Add(_labelBlock);
        _root.Children.Add(_radioButtons);
        Content = _root;
    }

    public void SetOptions(List<RadioGroupOption> options, string selectedValue)
    {
        _options = options;
        _selectedValue = selectedValue;
        UpdateVisual();
    }

    private void OnSelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (_radioButtons.SelectedIndex >= 0 && _radioButtons.SelectedIndex < _options.Count)
        {
            _selectedValue = _options[_radioButtons.SelectedIndex].Value;
            ValueChanged?.Invoke(this, _selectedValue);
        }
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefRadioGroup)d).UpdateVisual();

    private void UpdateVisual()
    {
        _labelBlock.Text = Label ?? "";
        _labelBlock.Visibility = string.IsNullOrEmpty(Label) ? Visibility.Collapsed : Visibility.Visible;
        _radioButtons.Header = null;
        _radioButtons.Items.Clear();
        foreach (var option in _options)
        {
            var rb = new RadioButton { Content = option.Label, IsEnabled = !option.Disabled };
            if (option.Value == _selectedValue) rb.IsChecked = true;
            _radioButtons.Items.Add(rb);
        }
    }
}
