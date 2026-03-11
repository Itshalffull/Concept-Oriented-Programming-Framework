// ============================================================
// Clef Surface WinUI Widget — ComboboxMulti
//
// Searchable multi-choice selector. Combines a text input with
// a filtered dropdown list of checkboxes. Selected values
// appear as chips above the input. Maps the combobox-multi
// widget anatomy to WinUI 3 AutoSuggestBox with chip display.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System.Collections.Generic;
using System.Linq;

namespace Clef.Surface.WinUI.Widgets.FormControls;

public record ComboboxMultiOption(string Label, string Value);

public sealed class ClefComboboxMulti : UserControl
{
    public static readonly DependencyProperty LabelProperty =
        DependencyProperty.Register(nameof(Label), typeof(string), typeof(ClefComboboxMulti),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty PlaceholderProperty =
        DependencyProperty.Register(nameof(Placeholder), typeof(string), typeof(ClefComboboxMulti),
            new PropertyMetadata("Search..."));

    public string Label { get => (string)GetValue(LabelProperty); set => SetValue(LabelProperty, value); }
    public string Placeholder { get => (string)GetValue(PlaceholderProperty); set => SetValue(PlaceholderProperty, value); }

    public event System.EventHandler<List<string>> ValueChanged;

    private List<ComboboxMultiOption> _options = new();
    private List<string> _selectedValues = new();
    private readonly StackPanel _root;
    private readonly TextBlock _labelBlock;
    private readonly StackPanel _chipsPanel;
    private readonly AutoSuggestBox _suggestBox;

    public ClefComboboxMulti()
    {
        _labelBlock = new TextBlock { Visibility = Visibility.Collapsed, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
        _chipsPanel = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
        _suggestBox = new AutoSuggestBox { PlaceholderText = Placeholder };
        _suggestBox.TextChanged += OnTextChanged;
        _suggestBox.SuggestionChosen += OnSuggestionChosen;
        _root = new StackPanel { Spacing = 4 };
        _root.Children.Add(_labelBlock);
        _root.Children.Add(_chipsPanel);
        _root.Children.Add(_suggestBox);
        Content = _root;
    }

    public void SetOptions(List<ComboboxMultiOption> options, List<string> selectedValues)
    {
        _options = options;
        _selectedValues = selectedValues.ToList();
        UpdateVisual();
        RebuildChips();
    }

    private void OnTextChanged(AutoSuggestBox sender, AutoSuggestBoxTextChangedEventArgs args)
    {
        if (args.Reason == AutoSuggestionBoxTextChangeReason.UserInput)
        {
            var query = sender.Text.ToLowerInvariant();
            sender.ItemsSource = string.IsNullOrEmpty(query)
                ? _options.Select(o => (_selectedValues.Contains(o.Value) ? "\u2611 " : "\u2610 ") + o.Label).ToList()
                : _options.Where(o => o.Label.ToLowerInvariant().Contains(query))
                    .Select(o => (_selectedValues.Contains(o.Value) ? "\u2611 " : "\u2610 ") + o.Label).ToList();
        }
    }

    private void OnSuggestionChosen(AutoSuggestBox sender, AutoSuggestBoxSuggestionChosenEventArgs args)
    {
        var label = args.SelectedItem?.ToString()?.Substring(2);
        var option = _options.FirstOrDefault(o => o.Label == label);
        if (option != null)
        {
            if (_selectedValues.Contains(option.Value))
                _selectedValues.Remove(option.Value);
            else
                _selectedValues.Add(option.Value);
            ValueChanged?.Invoke(this, _selectedValues.ToList());
            RebuildChips();
        }
        sender.Text = "";
    }

    private void RebuildChips()
    {
        _chipsPanel.Children.Clear();
        foreach (var val in _selectedValues)
        {
            var option = _options.FirstOrDefault(o => o.Value == val);
            var text = option?.Label ?? val;
            var removeBtn = new Button { Content = "\u2715", Padding = new Thickness(2), FontSize = 10, Background = new SolidColorBrush(Colors.Transparent) };
            var v = val;
            removeBtn.Click += (s, e) => { _selectedValues.Remove(v); ValueChanged?.Invoke(this, _selectedValues.ToList()); RebuildChips(); };
            var panel = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            panel.Children.Add(new TextBlock { Text = text, VerticalAlignment = VerticalAlignment.Center });
            panel.Children.Add(removeBtn);
            _chipsPanel.Children.Add(new Border { Child = panel, Padding = new Thickness(6, 2, 2, 2), CornerRadius = new CornerRadius(12), Background = new SolidColorBrush(Colors.LightGray) });
        }
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefComboboxMulti)d).UpdateVisual();

    private void UpdateVisual()
    {
        _labelBlock.Text = Label ?? "";
        _labelBlock.Visibility = string.IsNullOrEmpty(Label) ? Visibility.Collapsed : Visibility.Visible;
        _suggestBox.PlaceholderText = Placeholder;
    }
}
