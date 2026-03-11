// ============================================================
// Clef Surface WinUI Widget — ChipInput
//
// Free-form multi-value input that creates removable chips
// from typed text. Enter adds a chip, backspace on empty input
// removes the last chip. Maps the chip-input.widget anatomy
// to WinUI 3 TextBox + chip Border elements.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System.Collections.Generic;
using System.Linq;

namespace Clef.Surface.WinUI.Widgets.FormControls;

public sealed class ClefChipInput : UserControl
{
    public static readonly DependencyProperty PlaceholderProperty =
        DependencyProperty.Register(nameof(Placeholder), typeof(string), typeof(ClefChipInput),
            new PropertyMetadata("Type and press Enter..."));

    public static readonly DependencyProperty IsEnabledOverrideProperty =
        DependencyProperty.Register(nameof(IsEnabledOverride), typeof(bool), typeof(ClefChipInput),
            new PropertyMetadata(true));

    public string Placeholder { get => (string)GetValue(PlaceholderProperty); set => SetValue(PlaceholderProperty, value); }
    public bool IsEnabledOverride { get => (bool)GetValue(IsEnabledOverrideProperty); set => SetValue(IsEnabledOverrideProperty, value); }

    public event System.EventHandler<string> ChipAdded;
    public event System.EventHandler<int> ChipRemoved;

    private readonly List<string> _chips = new();
    private readonly WrapPanel _wrapPanel;
    private readonly TextBox _input;
    private readonly StackPanel _root;

    public ClefChipInput()
    {
        _wrapPanel = new WrapPanel();
        _input = new TextBox { PlaceholderText = Placeholder };
        _input.KeyDown += OnInputKeyDown;
        _root = new StackPanel { Spacing = 4 };
        _root.Children.Add(_wrapPanel);
        _root.Children.Add(_input);
        Content = _root;
    }

    public void SetChips(List<string> chips)
    {
        _chips.Clear();
        _chips.AddRange(chips);
        RebuildChips();
    }

    private void OnInputKeyDown(object sender, KeyRoutedEventArgs e)
    {
        if (e.Key == Windows.System.VirtualKey.Enter)
        {
            var text = _input.Text.Trim();
            if (!string.IsNullOrEmpty(text) && !_chips.Contains(text))
            {
                _chips.Add(text);
                _input.Text = "";
                ChipAdded?.Invoke(this, text);
                RebuildChips();
            }
            e.Handled = true;
        }
        else if (e.Key == Windows.System.VirtualKey.Back && string.IsNullOrEmpty(_input.Text) && _chips.Count > 0)
        {
            var index = _chips.Count - 1;
            _chips.RemoveAt(index);
            ChipRemoved?.Invoke(this, index);
            RebuildChips();
            e.Handled = true;
        }
    }

    private void RebuildChips()
    {
        _wrapPanel.Children.Clear();
        for (int i = 0; i < _chips.Count; i++)
        {
            var idx = i;
            var chip = _chips[i];
            var removeBtn = new Button
            {
                Content = "\u2715",
                Padding = new Thickness(2),
                Background = new SolidColorBrush(Colors.Transparent),
                FontSize = 10
            };
            removeBtn.Click += (s, e) =>
            {
                if (idx < _chips.Count)
                {
                    _chips.RemoveAt(idx);
                    ChipRemoved?.Invoke(this, idx);
                    RebuildChips();
                }
            };
            var panel = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            panel.Children.Add(new TextBlock { Text = chip, VerticalAlignment = VerticalAlignment.Center });
            panel.Children.Add(removeBtn);
            var border = new Border
            {
                Child = panel,
                Padding = new Thickness(8, 4, 4, 4),
                CornerRadius = new CornerRadius(16),
                Background = new SolidColorBrush(Colors.LightGray),
                Margin = new Thickness(0, 0, 4, 4)
            };
            _wrapPanel.Children.Add(border);
        }
    }

    // Simple WrapPanel using StackPanel fallback for WinUI 3
    private class WrapPanel : StackPanel
    {
        public WrapPanel()
        {
            Orientation = Orientation.Horizontal;
            Spacing = 4;
        }
    }
}
