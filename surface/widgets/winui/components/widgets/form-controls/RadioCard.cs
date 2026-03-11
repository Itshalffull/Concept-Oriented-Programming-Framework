// ============================================================
// Clef Surface WinUI Widget — RadioCard
//
// Visual single-choice selection using rich card-style options.
// Each card renders inside a Border with a RadioButton
// indicator, label, and optional description. Maps the
// radio-card.widget anatomy to WinUI 3 Border with RadioButton.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System.Collections.Generic;

namespace Clef.Surface.WinUI.Widgets.FormControls;

public record RadioCardOption(string Label, string Value, string Description = null);

public sealed class ClefRadioCard : UserControl
{
    public static readonly DependencyProperty IsEnabledOverrideProperty =
        DependencyProperty.Register(nameof(IsEnabledOverride), typeof(bool), typeof(ClefRadioCard),
            new PropertyMetadata(true));

    public bool IsEnabledOverride { get => (bool)GetValue(IsEnabledOverrideProperty); set => SetValue(IsEnabledOverrideProperty, value); }

    public event System.EventHandler<string> ValueChanged;

    private List<RadioCardOption> _options = new();
    private string _selectedValue;
    private readonly StackPanel _root;

    public ClefRadioCard()
    {
        _root = new StackPanel { Spacing = 8 };
        Content = _root;
    }

    public void SetOptions(List<RadioCardOption> options, string selectedValue)
    {
        _options = options;
        _selectedValue = selectedValue;
        RebuildCards();
    }

    private void RebuildCards()
    {
        _root.Children.Clear();
        foreach (var option in _options)
        {
            var isSelected = option.Value == _selectedValue;
            var radio = new RadioButton { IsChecked = isSelected, IsEnabled = IsEnabledOverride, GroupName = "RadioCard" };
            var titleText = new TextBlock { Text = option.Label, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
            var contentPanel = new StackPanel { Spacing = 4 };
            contentPanel.Children.Add(titleText);
            if (!string.IsNullOrEmpty(option.Description))
                contentPanel.Children.Add(new TextBlock { Text = option.Description, Opacity = 0.7 });
            var row = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 12 };
            row.Children.Add(radio);
            row.Children.Add(contentPanel);
            var border = new Border
            {
                Child = row,
                Padding = new Thickness(16),
                BorderThickness = new Thickness(isSelected ? 2 : 1),
                BorderBrush = new SolidColorBrush(isSelected ? Colors.CornflowerBlue : Colors.Gray),
                CornerRadius = new CornerRadius(8)
            };
            var val = option.Value;
            border.PointerPressed += (s, e) =>
            {
                if (IsEnabledOverride)
                {
                    _selectedValue = val;
                    ValueChanged?.Invoke(this, val);
                    RebuildCards();
                }
            };
            _root.Children.Add(border);
        }
    }
}
