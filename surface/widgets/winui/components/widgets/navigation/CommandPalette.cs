// ============================================================
// Clef Surface WinUI Widget — CommandPalette
//
// Keyboard-driven command search overlay. Displays a filterable
// list of actions triggered via a hotkey. Maps the
// commandpalette.widget spec to WinUI 3 AutoSuggestBox + Popup.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Collections.Generic;
using System.Linq;

namespace Clef.Surface.WinUI.Widgets.Navigation;

public sealed class ClefCommandPalette : UserControl
{
    public static readonly DependencyProperty IsOpenProperty =
        DependencyProperty.Register(nameof(IsOpen), typeof(bool), typeof(ClefCommandPalette),
            new PropertyMetadata(false, OnPropertyChanged));

    public static readonly DependencyProperty PlaceholderProperty =
        DependencyProperty.Register(nameof(Placeholder), typeof(string), typeof(ClefCommandPalette),
            new PropertyMetadata("Type a command..."));

    public bool IsOpen { get => (bool)GetValue(IsOpenProperty); set => SetValue(IsOpenProperty, value); }
    public string Placeholder { get => (string)GetValue(PlaceholderProperty); set => SetValue(PlaceholderProperty, value); }

    public event System.EventHandler<string> CommandSelected;

    private readonly Grid _overlay;
    private readonly StackPanel _panel;
    private readonly AutoSuggestBox _searchBox;
    private readonly ListView _resultList;
    private readonly List<string> _commands = new();

    public ClefCommandPalette()
    {
        _searchBox = new AutoSuggestBox { PlaceholderText = Placeholder, Width = 400 };
        _searchBox.TextChanged += (s, e) =>
        {
            if (e.Reason == AutoSuggestionBoxTextChangeReason.UserInput)
            {
                var filtered = _commands.Where(c => c.Contains(s.Text, System.StringComparison.OrdinalIgnoreCase)).ToList();
                _resultList.ItemsSource = filtered;
            }
        };
        _searchBox.QuerySubmitted += (s, e) => CommandSelected?.Invoke(this, e.QueryText);
        _resultList = new ListView { MaxHeight = 300 };
        _resultList.SelectionChanged += (s, e) =>
        {
            if (_resultList.SelectedItem is string cmd)
            {
                CommandSelected?.Invoke(this, cmd);
                IsOpen = false;
            }
        };
        _panel = new StackPanel
        {
            Spacing = 4,
            Padding = new Thickness(16),
            Background = new Microsoft.UI.Xaml.Media.SolidColorBrush(Microsoft.UI.Colors.White)
        };
        _panel.Children.Add(_searchBox);
        _panel.Children.Add(_resultList);
        _overlay = new Grid { Visibility = Visibility.Collapsed };
        _overlay.Children.Add(_panel);
        Content = _overlay;
    }

    public void SetCommands(IEnumerable<string> commands)
    {
        _commands.Clear();
        _commands.AddRange(commands);
        _resultList.ItemsSource = _commands;
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefCommandPalette)d).UpdateVisual();

    private void UpdateVisual()
    {
        _overlay.Visibility = IsOpen ? Visibility.Visible : Visibility.Collapsed;
    }
}
