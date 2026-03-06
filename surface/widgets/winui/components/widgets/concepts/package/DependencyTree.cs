using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System;

namespace Clef.Surface.Widgets.Concepts.Package
{
    public sealed partial class DependencyTree : UserControl
    {
        private enum WidgetState { Idle, NodeSelected, Searching, Filtering }
        private enum WidgetEvent { SelectNode, Deselect, Search, ClearSearch, Filter, ClearFilter }

        private WidgetState _state = WidgetState.Idle;
        private readonly StackPanel _root;
        private readonly TextBlock _title;
        private readonly TextBox _searchInput;
        private readonly Button _clearSearchButton;
        private readonly StackPanel _statsPanel;
        private readonly TextBlock _totalDeps;
        private readonly TextBlock _directDeps;
        private readonly ScrollViewer _scrollViewer;
        private readonly StackPanel _treePanel;
        private readonly StackPanel _detailPanel;
        private readonly TextBlock _detailName;
        private readonly TextBlock _detailVersion;
        private readonly TextBlock _detailLicense;
        private readonly TextBlock _detailSize;
        private readonly Button _closeDetailButton;

        public event Action<string> OnNodeSelect;

        public DependencyTree()
        {
            _root = new StackPanel { Orientation = Orientation.Vertical, Spacing = 8, Padding = new Thickness(12) };

            // Header
            _title = new TextBlock { Text = "Dependency Tree", FontSize = 16, FontWeight = Microsoft.UI.Text.FontWeights.Bold };
            _root.Children.Add(_title);

            // Search
            var searchBar = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            _searchInput = new TextBox { PlaceholderText = "Search packages...", Width = 200 };
            AutomationProperties.SetName(_searchInput, "Search dependencies");
            _searchInput.TextChanged += (s, e) =>
            {
                if (!string.IsNullOrEmpty(_searchInput.Text)) Send(WidgetEvent.Search);
            };
            _clearSearchButton = new Button { Content = "\u2715", Visibility = Visibility.Collapsed };
            _clearSearchButton.Click += (s, e) =>
            {
                _searchInput.Text = "";
                Send(WidgetEvent.ClearSearch);
            };
            AutomationProperties.SetName(_clearSearchButton, "Clear search");
            searchBar.Children.Add(_searchInput);
            searchBar.Children.Add(_clearSearchButton);
            _root.Children.Add(searchBar);

            // Stats
            _statsPanel = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 12 };
            _totalDeps = new TextBlock { Text = "0 total", FontSize = 12, Opacity = 0.7 };
            _directDeps = new TextBlock { Text = "0 direct", FontSize = 12, Opacity = 0.7 };
            _statsPanel.Children.Add(_totalDeps);
            _statsPanel.Children.Add(_directDeps);
            _root.Children.Add(_statsPanel);

            // Tree
            _treePanel = new StackPanel { Orientation = Orientation.Vertical, Spacing = 2 };
            _scrollViewer = new ScrollViewer { Content = _treePanel, MaxHeight = 400 };
            _root.Children.Add(_scrollViewer);

            // Detail panel (hidden)
            _detailPanel = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4, Visibility = Visibility.Collapsed, Padding = new Thickness(8) };
            var detailHeader = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            _detailName = new TextBlock { Text = "", FontSize = 14, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
            _closeDetailButton = new Button { Content = "\u2715", FontSize = 11 };
            _closeDetailButton.Click += (s, e) => Send(WidgetEvent.Deselect);
            AutomationProperties.SetName(_closeDetailButton, "Close detail");
            detailHeader.Children.Add(_detailName);
            detailHeader.Children.Add(_closeDetailButton);
            _detailVersion = new TextBlock { Text = "", FontSize = 12 };
            _detailLicense = new TextBlock { Text = "", FontSize = 12, Opacity = 0.7 };
            _detailSize = new TextBlock { Text = "", FontSize = 12, Opacity = 0.7 };
            _detailPanel.Children.Add(detailHeader);
            _detailPanel.Children.Add(_detailVersion);
            _detailPanel.Children.Add(_detailLicense);
            _detailPanel.Children.Add(_detailSize);
            _root.Children.Add(_detailPanel);

            this.Content = _root;
            AutomationProperties.SetName(this, "Interactive dependency tree viewer for package dependencies");
        }

        public void SetStats(int total, int direct)
        {
            _totalDeps.Text = $"{total} total";
            _directDeps.Text = $"{direct} direct";
        }

        public void AddNode(string name, string version, int depth = 0, string license = null, string size = null, bool outdated = false)
        {
            var nodePanel = new StackPanel
            {
                Orientation = Orientation.Horizontal,
                Spacing = 8,
                Padding = new Thickness(depth * 16 + 4, 4, 4, 4)
            };

            var icon = new TextBlock { Text = depth == 0 ? "\u25BC" : "\u251C", FontSize = 11, Opacity = 0.5, VerticalAlignment = VerticalAlignment.Center };
            var nameText = new TextBlock { Text = name, FontSize = 13, VerticalAlignment = VerticalAlignment.Center };
            var versionText = new TextBlock { Text = $"@{version}", FontSize = 11, Opacity = 0.6, VerticalAlignment = VerticalAlignment.Center };

            if (outdated)
            {
                nameText.Foreground = new SolidColorBrush(Colors.Orange);
            }

            nodePanel.Children.Add(icon);
            nodePanel.Children.Add(nameText);
            nodePanel.Children.Add(versionText);

            nodePanel.PointerPressed += (s, e) =>
            {
                _detailName.Text = name;
                _detailVersion.Text = $"Version: {version}";
                _detailLicense.Text = license != null ? $"License: {license}" : "";
                _detailSize.Text = size != null ? $"Size: {size}" : "";
                Send(WidgetEvent.SelectNode);
                OnNodeSelect?.Invoke(name);
            };

            AutomationProperties.SetName(nodePanel, $"{name}@{version}");
            _treePanel.Children.Add(nodePanel);
        }

        public void Send(WidgetEvent evt)
        {
            _state = Reduce(_state, evt);
            _detailPanel.Visibility = _state == WidgetState.NodeSelected ? Visibility.Visible : Visibility.Collapsed;
            _clearSearchButton.Visibility = _state == WidgetState.Searching ? Visibility.Visible : Visibility.Collapsed;
        }

        private WidgetState Reduce(WidgetState state, WidgetEvent evt) => state switch
        {
            WidgetState.Idle when evt == WidgetEvent.SelectNode => WidgetState.NodeSelected,
            WidgetState.Idle when evt == WidgetEvent.Search => WidgetState.Searching,
            WidgetState.NodeSelected when evt == WidgetEvent.Deselect => WidgetState.Idle,
            WidgetState.NodeSelected when evt == WidgetEvent.SelectNode => WidgetState.NodeSelected,
            WidgetState.Searching when evt == WidgetEvent.ClearSearch => WidgetState.Idle,
            WidgetState.Searching when evt == WidgetEvent.SelectNode => WidgetState.NodeSelected,
            _ => state
        };
    }
}
