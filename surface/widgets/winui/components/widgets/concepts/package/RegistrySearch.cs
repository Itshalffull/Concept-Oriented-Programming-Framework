using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System;

namespace Clef.Surface.Widgets.Concepts.Package
{
    public sealed partial class RegistrySearch : UserControl
    {
        private enum WidgetState { Idle, Searching, Results, DetailView, Error }
        private enum WidgetEvent { Search, SearchComplete, SearchFail, SelectPackage, Deselect, Clear }

        private WidgetState _state = WidgetState.Idle;
        private readonly StackPanel _root;
        private readonly TextBlock _title;
        private readonly StackPanel _searchBar;
        private readonly TextBox _searchInput;
        private readonly Button _searchButton;
        private readonly Button _clearButton;
        private readonly ProgressRing _searchRing;
        private readonly TextBlock _resultCount;
        private readonly ScrollViewer _scrollViewer;
        private readonly StackPanel _resultList;
        private readonly StackPanel _detailPanel;
        private readonly TextBlock _detailName;
        private readonly TextBlock _detailVersion;
        private readonly TextBlock _detailDescription;
        private readonly TextBlock _detailDownloads;
        private readonly TextBlock _detailLicense;
        private readonly Button _installButton;
        private readonly Button _closeDetailButton;
        private readonly TextBlock _errorText;

        public event Action<string> OnSearch;
        public event Action<string> OnInstall;

        public RegistrySearch()
        {
            _root = new StackPanel { Orientation = Orientation.Vertical, Spacing = 8, Padding = new Thickness(12) };

            // Header
            _title = new TextBlock { Text = "Package Registry", FontSize = 16, FontWeight = Microsoft.UI.Text.FontWeights.Bold };
            _root.Children.Add(_title);

            // Search bar
            _searchBar = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            _searchInput = new TextBox { PlaceholderText = "Search packages...", Width = 250 };
            AutomationProperties.SetName(_searchInput, "Search package registry");
            _searchInput.KeyDown += (s, e) =>
            {
                if (e.Key == Windows.System.VirtualKey.Enter) HandleSearch();
            };
            _searchButton = new Button { Content = "\u2315 Search" };
            _searchButton.Click += (s, e) => HandleSearch();
            AutomationProperties.SetName(_searchButton, "Search");
            _clearButton = new Button { Content = "\u2715", Visibility = Visibility.Collapsed };
            _clearButton.Click += (s, e) =>
            {
                _searchInput.Text = "";
                _resultList.Children.Clear();
                Send(WidgetEvent.Clear);
            };
            AutomationProperties.SetName(_clearButton, "Clear search");
            _searchRing = new ProgressRing { IsActive = false, Width = 16, Height = 16, Visibility = Visibility.Collapsed };
            _searchBar.Children.Add(_searchInput);
            _searchBar.Children.Add(_searchButton);
            _searchBar.Children.Add(_clearButton);
            _searchBar.Children.Add(_searchRing);
            _root.Children.Add(_searchBar);

            // Result count
            _resultCount = new TextBlock { Text = "", FontSize = 12, Opacity = 0.7, Visibility = Visibility.Collapsed };
            _root.Children.Add(_resultCount);

            // Results list
            _resultList = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4 };
            _scrollViewer = new ScrollViewer { Content = _resultList, MaxHeight = 400 };
            _root.Children.Add(_scrollViewer);

            // Error text
            _errorText = new TextBlock { Text = "", FontSize = 12, Foreground = new SolidColorBrush(Colors.Red), Visibility = Visibility.Collapsed, TextWrapping = TextWrapping.Wrap };
            _root.Children.Add(_errorText);

            // Detail panel (hidden)
            _detailPanel = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4, Visibility = Visibility.Collapsed, Padding = new Thickness(8) };
            var detailHeader = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            _detailName = new TextBlock { Text = "", FontSize = 14, FontWeight = Microsoft.UI.Text.FontWeights.Bold };
            _closeDetailButton = new Button { Content = "\u2715", FontSize = 11 };
            _closeDetailButton.Click += (s, e) => Send(WidgetEvent.Deselect);
            AutomationProperties.SetName(_closeDetailButton, "Close detail");
            detailHeader.Children.Add(_detailName);
            detailHeader.Children.Add(_closeDetailButton);
            _detailVersion = new TextBlock { Text = "", FontSize = 12 };
            _detailDescription = new TextBlock { Text = "", FontSize = 12, TextWrapping = TextWrapping.Wrap };
            _detailDownloads = new TextBlock { Text = "", FontSize = 11, Opacity = 0.6 };
            _detailLicense = new TextBlock { Text = "", FontSize = 11, Opacity = 0.6 };
            _installButton = new Button { Content = "Install" };
            _installButton.Click += (s, e) => OnInstall?.Invoke(_detailName.Text);
            AutomationProperties.SetName(_installButton, "Install package");
            _detailPanel.Children.Add(detailHeader);
            _detailPanel.Children.Add(_detailVersion);
            _detailPanel.Children.Add(_detailDescription);
            _detailPanel.Children.Add(_detailDownloads);
            _detailPanel.Children.Add(_detailLicense);
            _detailPanel.Children.Add(_installButton);
            _root.Children.Add(_detailPanel);

            this.Content = _root;
            AutomationProperties.SetName(this, "Search interface for the package registry");
        }

        private void HandleSearch()
        {
            if (string.IsNullOrWhiteSpace(_searchInput.Text)) return;
            Send(WidgetEvent.Search);
            OnSearch?.Invoke(_searchInput.Text);
        }

        public void AddResult(string name, string version, string description, string downloads = null)
        {
            var item = new Border { Padding = new Thickness(8), CornerRadius = new CornerRadius(4), BorderThickness = new Thickness(1), BorderBrush = new SolidColorBrush(Colors.Gray) };
            var content = new StackPanel { Orientation = Orientation.Vertical, Spacing = 2 };
            var headerRow = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            headerRow.Children.Add(new TextBlock { Text = name, FontSize = 13, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold });
            headerRow.Children.Add(new TextBlock { Text = version, FontSize = 11, Opacity = 0.6, VerticalAlignment = VerticalAlignment.Center });
            if (downloads != null)
                headerRow.Children.Add(new TextBlock { Text = $"\u2913 {downloads}", FontSize = 11, Opacity = 0.5, VerticalAlignment = VerticalAlignment.Center });
            content.Children.Add(headerRow);
            content.Children.Add(new TextBlock { Text = description, FontSize = 12, Opacity = 0.8, MaxLines = 2, TextTrimming = TextTrimming.CharacterEllipsis });
            item.Child = content;

            item.PointerPressed += (s, e) =>
            {
                _detailName.Text = name;
                _detailVersion.Text = $"Version: {version}";
                _detailDescription.Text = description;
                _detailDownloads.Text = downloads != null ? $"Downloads: {downloads}" : "";
                Send(WidgetEvent.SelectPackage);
            };

            AutomationProperties.SetName(item, $"{name}@{version}");
            _resultList.Children.Add(item);
        }

        public void SetResults(int count)
        {
            _resultCount.Text = $"{count} results";
            _resultCount.Visibility = Visibility.Visible;
            Send(WidgetEvent.SearchComplete);
        }

        public void SetError(string error)
        {
            _errorText.Text = error;
            Send(WidgetEvent.SearchFail);
        }

        public void Send(WidgetEvent evt)
        {
            _state = Reduce(_state, evt);
            UpdateVisuals();
        }

        private void UpdateVisuals()
        {
            _searchRing.IsActive = _state == WidgetState.Searching;
            _searchRing.Visibility = _state == WidgetState.Searching ? Visibility.Visible : Visibility.Collapsed;
            _searchButton.IsEnabled = _state != WidgetState.Searching;
            _clearButton.Visibility = _state == WidgetState.Results || _state == WidgetState.DetailView ? Visibility.Visible : Visibility.Collapsed;
            _detailPanel.Visibility = _state == WidgetState.DetailView ? Visibility.Visible : Visibility.Collapsed;
            _errorText.Visibility = _state == WidgetState.Error ? Visibility.Visible : Visibility.Collapsed;
        }

        private WidgetState Reduce(WidgetState state, WidgetEvent evt) => state switch
        {
            WidgetState.Idle when evt == WidgetEvent.Search => WidgetState.Searching,
            WidgetState.Searching when evt == WidgetEvent.SearchComplete => WidgetState.Results,
            WidgetState.Searching when evt == WidgetEvent.SearchFail => WidgetState.Error,
            WidgetState.Results when evt == WidgetEvent.SelectPackage => WidgetState.DetailView,
            WidgetState.Results when evt == WidgetEvent.Search => WidgetState.Searching,
            WidgetState.Results when evt == WidgetEvent.Clear => WidgetState.Idle,
            WidgetState.DetailView when evt == WidgetEvent.Deselect => WidgetState.Results,
            WidgetState.DetailView when evt == WidgetEvent.SelectPackage => WidgetState.DetailView,
            WidgetState.Error when evt == WidgetEvent.Search => WidgetState.Searching,
            WidgetState.Error when evt == WidgetEvent.Clear => WidgetState.Idle,
            _ => state
        };
    }
}
