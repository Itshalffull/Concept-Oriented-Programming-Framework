// ============================================================
// Clef Surface WinUI Widget — FacetedSearch
//
// Search interface with sidebar facet filters and a result
// list. Maps the facetedsearch.widget spec to WinUI 3
// SplitView with filter checkboxes and ListView results.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Collections.Generic;

namespace Clef.Surface.WinUI.Widgets.Composites;

public sealed class ClefFacetedSearch : UserControl
{
    public static readonly DependencyProperty PlaceholderProperty =
        DependencyProperty.Register(nameof(Placeholder), typeof(string), typeof(ClefFacetedSearch),
            new PropertyMetadata("Search..."));

    public string Placeholder { get => (string)GetValue(PlaceholderProperty); set => SetValue(PlaceholderProperty, value); }

    public event System.EventHandler<string> SearchSubmitted;
    public event System.EventHandler<(string Facet, string Value, bool Selected)> FacetChanged;

    private readonly SplitView _splitView;
    private readonly StackPanel _facetPanel;
    private readonly StackPanel _resultPanel;
    private readonly AutoSuggestBox _searchBox;
    private readonly ListView _resultList;

    public ClefFacetedSearch()
    {
        _facetPanel = new StackPanel { Spacing = 12, Padding = new Thickness(12) };
        _searchBox = new AutoSuggestBox { PlaceholderText = Placeholder, HorizontalAlignment = HorizontalAlignment.Stretch };
        _searchBox.QuerySubmitted += (s, e) => SearchSubmitted?.Invoke(this, e.QueryText);
        _resultList = new ListView();
        _resultPanel = new StackPanel { Spacing = 8, Padding = new Thickness(12) };
        _resultPanel.Children.Add(_searchBox);
        _resultPanel.Children.Add(_resultList);
        _splitView = new SplitView
        {
            Pane = new ScrollViewer { Content = _facetPanel },
            Content = _resultPanel,
            DisplayMode = SplitViewDisplayMode.Inline,
            IsPaneOpen = true,
            OpenPaneLength = 220
        };
        Content = _splitView;
    }

    public void AddFacetGroup(string name, IEnumerable<string> values)
    {
        var header = new TextBlock { Text = name, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
        _facetPanel.Children.Add(header);
        foreach (var val in values)
        {
            string v = val;
            var cb = new CheckBox { Content = val };
            cb.Checked += (s, e) => FacetChanged?.Invoke(this, (name, v, true));
            cb.Unchecked += (s, e) => FacetChanged?.Invoke(this, (name, v, false));
            _facetPanel.Children.Add(cb);
        }
    }

    public void SetResults(object source) => _resultList.ItemsSource = source;
}
