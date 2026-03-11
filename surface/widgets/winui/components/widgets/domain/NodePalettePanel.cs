// ============================================================
// Clef Surface WinUI Widget — NodePalettePanel
//
// Draggable palette of node types from a DiagramNotation. Users
// drag items from the palette onto the canvas to create new
// nodes. Maps the node-palette-panel.widget spec to WinUI 3
// UserControl with GridView and TextBox search filter.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Domain;

public sealed class ClefNodePalettePanel : UserControl
{
    public static readonly DependencyProperty NotationIdProperty =
        DependencyProperty.Register(nameof(NotationId), typeof(string), typeof(ClefNodePalettePanel),
            new PropertyMetadata("", OnPropertyChanged));

    public static readonly DependencyProperty NotationNameProperty =
        DependencyProperty.Register(nameof(NotationName), typeof(string), typeof(ClefNodePalettePanel),
            new PropertyMetadata("", OnPropertyChanged));

    public static readonly DependencyProperty SearchQueryProperty =
        DependencyProperty.Register(nameof(SearchQuery), typeof(string), typeof(ClefNodePalettePanel),
            new PropertyMetadata("", OnPropertyChanged));

    public static readonly DependencyProperty OrientationProperty =
        DependencyProperty.Register(nameof(PanelOrientation), typeof(string), typeof(ClefNodePalettePanel),
            new PropertyMetadata("vertical", OnPropertyChanged));

    public string NotationId { get => (string)GetValue(NotationIdProperty); set => SetValue(NotationIdProperty, value); }
    public string NotationName { get => (string)GetValue(NotationNameProperty); set => SetValue(NotationNameProperty, value); }
    public string SearchQuery { get => (string)GetValue(SearchQueryProperty); set => SetValue(SearchQueryProperty, value); }
    public string PanelOrientation { get => (string)GetValue(OrientationProperty); set => SetValue(OrientationProperty, value); }

    public event System.EventHandler<string> DragStarting;
    public event System.EventHandler<string> SearchChanged;

    private readonly StackPanel _root;
    private readonly TextBlock _header;
    private readonly TextBox _searchFilter;
    private readonly GridView _typeGrid;
    private readonly System.Collections.Generic.List<NodeTypeItem> _types = new();

    public ClefNodePalettePanel()
    {
        _header = new TextBlock
        {
            FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
            FontSize = 14,
            Margin = new Thickness(0, 0, 0, 8)
        };

        _searchFilter = new TextBox
        {
            PlaceholderText = "Search node types...",
            Margin = new Thickness(0, 0, 0, 8)
        };
        _searchFilter.TextChanged += (s, e) =>
        {
            SearchQuery = _searchFilter.Text;
            SearchChanged?.Invoke(this, _searchFilter.Text);
            ApplyFilter();
        };

        _typeGrid = new GridView
        {
            SelectionMode = ListViewSelectionMode.None,
            CanDragItems = true,
            AllowDrop = false
        };
        _typeGrid.DragItemsStarting += (s, e) =>
        {
            if (e.Items.Count > 0 && e.Items[0] is NodeTypeItem item)
            {
                e.Data.SetText(item.TypeKey);
                DragStarting?.Invoke(this, item.TypeKey);
            }
        };

        _root = new StackPanel { Spacing = 4, Padding = new Thickness(8) };
        _root.Children.Add(_header);
        _root.Children.Add(_searchFilter);
        _root.Children.Add(_typeGrid);

        AutomationProperties.SetName(_root, "Node palette");
        Content = _root;
        UpdateVisual();
    }

    public void SetTypes(System.Collections.Generic.IEnumerable<NodeTypeItem> types)
    {
        _types.Clear();
        _types.AddRange(types);
        ApplyFilter();
    }

    private void ApplyFilter()
    {
        _typeGrid.Items.Clear();
        var query = (SearchQuery ?? "").ToLowerInvariant();
        foreach (var item in _types)
        {
            if (string.IsNullOrEmpty(query) || item.Label.ToLowerInvariant().Contains(query))
            {
                var btn = new Button
                {
                    Content = item.Label,
                    Tag = item.TypeKey,
                    Margin = new Thickness(2),
                    MinWidth = 80,
                    CanDrag = true
                };
                AutomationProperties.SetName(btn, $"Add {item.Label} node");
                _typeGrid.Items.Add(btn);
            }
        }
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefNodePalettePanel)d).UpdateVisual();

    private void UpdateVisual()
    {
        _header.Text = string.IsNullOrEmpty(NotationName) ? "Node Palette" : NotationName;
    }

    public record NodeTypeItem(string TypeKey, string Label, string Shape, string DefaultFill = "", string Icon = "");
}
