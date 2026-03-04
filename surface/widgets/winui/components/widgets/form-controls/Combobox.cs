// ============================================================
// Clef Surface WinUI Widget — Combobox
//
// Searchable single-choice selector. Combines a text input
// with a filtered dropdown. Maps the combobox.widget anatomy
// (root, label, input, content, item) to WinUI 3 AutoSuggestBox.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Collections.Generic;
using System.Linq;

namespace Clef.Surface.WinUI.Widgets.FormControls;

public record ComboboxOption(string Label, string Value);

public sealed class ClefCombobox : UserControl
{
    public static readonly DependencyProperty LabelProperty =
        DependencyProperty.Register(nameof(Label), typeof(string), typeof(ClefCombobox),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty PlaceholderProperty =
        DependencyProperty.Register(nameof(Placeholder), typeof(string), typeof(ClefCombobox),
            new PropertyMetadata("Search..."));

    public static readonly DependencyProperty IsEnabledOverrideProperty =
        DependencyProperty.Register(nameof(IsEnabledOverride), typeof(bool), typeof(ClefCombobox),
            new PropertyMetadata(true, OnPropertyChanged));

    public string Label { get => (string)GetValue(LabelProperty); set => SetValue(LabelProperty, value); }
    public string Placeholder { get => (string)GetValue(PlaceholderProperty); set => SetValue(PlaceholderProperty, value); }
    public bool IsEnabledOverride { get => (bool)GetValue(IsEnabledOverrideProperty); set => SetValue(IsEnabledOverrideProperty, value); }

    public event System.EventHandler<string> ValueChanged;

    private List<ComboboxOption> _options = new();
    private string _selectedValue;
    private readonly StackPanel _root;
    private readonly TextBlock _labelBlock;
    private readonly AutoSuggestBox _suggestBox;

    public ClefCombobox()
    {
        _labelBlock = new TextBlock { Visibility = Visibility.Collapsed, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
        _suggestBox = new AutoSuggestBox { PlaceholderText = Placeholder };
        _suggestBox.TextChanged += OnTextChanged;
        _suggestBox.SuggestionChosen += OnSuggestionChosen;
        _root = new StackPanel { Spacing = 4 };
        _root.Children.Add(_labelBlock);
        _root.Children.Add(_suggestBox);
        Content = _root;
    }

    public void SetOptions(List<ComboboxOption> options, string selectedValue = null)
    {
        _options = options;
        _selectedValue = selectedValue;
        _suggestBox.Text = _options.FirstOrDefault(o => o.Value == selectedValue)?.Label ?? "";
        UpdateVisual();
    }

    private void OnTextChanged(AutoSuggestBox sender, AutoSuggestBoxTextChangedEventArgs args)
    {
        if (args.Reason == AutoSuggestionBoxTextChangeReason.UserInput)
        {
            var query = sender.Text.ToLowerInvariant();
            sender.ItemsSource = string.IsNullOrEmpty(query)
                ? _options.Select(o => o.Label).ToList()
                : _options.Where(o => o.Label.ToLowerInvariant().Contains(query)).Select(o => o.Label).ToList();
        }
    }

    private void OnSuggestionChosen(AutoSuggestBox sender, AutoSuggestBoxSuggestionChosenEventArgs args)
    {
        var label = args.SelectedItem?.ToString();
        var option = _options.FirstOrDefault(o => o.Label == label);
        if (option != null)
        {
            _selectedValue = option.Value;
            ValueChanged?.Invoke(this, option.Value);
        }
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefCombobox)d).UpdateVisual();

    private void UpdateVisual()
    {
        _labelBlock.Text = Label ?? "";
        _labelBlock.Visibility = string.IsNullOrEmpty(Label) ? Visibility.Collapsed : Visibility.Visible;
        _suggestBox.IsEnabled = IsEnabledOverride;
        _suggestBox.PlaceholderText = Placeholder;
    }
}
