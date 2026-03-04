// ============================================================
// Clef Surface WinUI Widget — MentionInput
//
// Text input that triggers a mention picker when @ is typed.
// Shows a dropdown of matching users or entities. Maps the
// mentioninput.widget spec to WinUI 3 RichEditBox with
// AutoSuggestBox overlay.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Collections.Generic;
using System.Linq;

namespace Clef.Surface.WinUI.Widgets.ComplexInputs;

public sealed class ClefMentionInput : UserControl
{
    public static readonly DependencyProperty PlaceholderProperty =
        DependencyProperty.Register(nameof(Placeholder), typeof(string), typeof(ClefMentionInput),
            new PropertyMetadata("Type @ to mention..."));

    public string Placeholder { get => (string)GetValue(PlaceholderProperty); set => SetValue(PlaceholderProperty, value); }

    public event System.EventHandler<string> MentionSelected;
    public event System.EventHandler<string> TextChanged;

    private readonly RichEditBox _editor;
    private readonly ListView _suggestions;
    private readonly Grid _root;
    private readonly List<string> _mentionCandidates = new();

    public ClefMentionInput()
    {
        _editor = new RichEditBox { HorizontalAlignment = HorizontalAlignment.Stretch };
        _suggestions = new ListView
        {
            MaxHeight = 150,
            Visibility = Visibility.Collapsed
        };
        _suggestions.SelectionChanged += (s, e) =>
        {
            if (_suggestions.SelectedItem is string mention)
            {
                MentionSelected?.Invoke(this, mention);
                _suggestions.Visibility = Visibility.Collapsed;
            }
        };
        _root = new Grid();
        _root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        _root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        Grid.SetRow(_editor, 0);
        Grid.SetRow(_suggestions, 1);
        _root.Children.Add(_editor);
        _root.Children.Add(_suggestions);
        Content = _root;
    }

    public void SetMentionCandidates(IEnumerable<string> candidates)
    {
        _mentionCandidates.Clear();
        _mentionCandidates.AddRange(candidates);
    }

    public void ShowSuggestions(string query)
    {
        var filtered = _mentionCandidates
            .Where(c => c.Contains(query, System.StringComparison.OrdinalIgnoreCase))
            .ToList();
        _suggestions.ItemsSource = filtered;
        _suggestions.Visibility = filtered.Count > 0 ? Visibility.Visible : Visibility.Collapsed;
    }
}
