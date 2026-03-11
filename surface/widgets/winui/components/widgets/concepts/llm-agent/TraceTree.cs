using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System;
using System.Collections.Generic;

namespace Clef.Surface.Widgets.Concepts.LlmAgent
{
    public sealed partial class TraceTree : UserControl
    {
        private enum WidgetState { Idle, NodeSelected, Filtering, Searching }
        private enum WidgetEvent { SelectNode, Deselect, Filter, ClearFilter, Search, ClearSearch }

        private WidgetState _state = WidgetState.Idle;
        private readonly StackPanel _root;
        private readonly TextBlock _title;
        private readonly StackPanel _toolbar;
        private readonly TextBox _searchInput;
        private readonly Button _clearSearchButton;
        private readonly StackPanel _filterBar;
        private readonly ScrollViewer _scrollViewer;
        private readonly StackPanel _treePanel;
        private readonly StackPanel _detailPanel;
        private readonly TextBlock _detailTitle;
        private readonly TextBlock _detailType;
        private readonly TextBlock _detailDuration;
        private readonly TextBlock _detailContent;
        private readonly Button _closeDetailButton;
        private string _activeFilter = null;

        private static readonly string[] NodeTypes = { "llm", "tool", "chain", "retrieval", "agent" };
        private static readonly string[] NodeIcons = { "\u2B24", "\u2699", "\u26D3", "\u2315", "\u2605" };

        public event Action<int> OnNodeSelect;

        public TraceTree()
        {
            _root = new StackPanel { Orientation = Orientation.Vertical, Spacing = 8, Padding = new Thickness(12) };

            // Header
            _title = new TextBlock { Text = "Execution Trace", FontSize = 16, FontWeight = Microsoft.UI.Text.FontWeights.Bold };
            _root.Children.Add(_title);

            // Toolbar
            _toolbar = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            _searchInput = new TextBox { PlaceholderText = "Search spans...", Width = 180 };
            AutomationProperties.SetName(_searchInput, "Search trace spans");
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
            _toolbar.Children.Add(_searchInput);
            _toolbar.Children.Add(_clearSearchButton);
            _root.Children.Add(_toolbar);

            // Filter bar
            _filterBar = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            var allBtn = new Button { Content = "All" };
            allBtn.Click += (s, e) =>
            {
                _activeFilter = null;
                Send(WidgetEvent.ClearFilter);
            };
            _filterBar.Children.Add(allBtn);
            for (int i = 0; i < NodeTypes.Length; i++)
            {
                int idx = i;
                var btn = new Button { Content = $"{NodeIcons[idx]} {NodeTypes[idx]}" };
                btn.Click += (s, e) =>
                {
                    _activeFilter = _activeFilter == NodeTypes[idx] ? null : NodeTypes[idx];
                    Send(_activeFilter != null ? WidgetEvent.Filter : WidgetEvent.ClearFilter);
                };
                _filterBar.Children.Add(btn);
            }
            _root.Children.Add(_filterBar);

            // Tree view
            _treePanel = new StackPanel { Orientation = Orientation.Vertical, Spacing = 2 };
            _scrollViewer = new ScrollViewer { Content = _treePanel, MaxHeight = 400 };
            _root.Children.Add(_scrollViewer);

            // Detail panel (hidden)
            _detailPanel = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4, Visibility = Visibility.Collapsed, Padding = new Thickness(8) };
            var detailHeader = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            _detailTitle = new TextBlock { Text = "", FontSize = 14, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
            _closeDetailButton = new Button { Content = "\u2715", FontSize = 11 };
            _closeDetailButton.Click += (s, e) => Send(WidgetEvent.Deselect);
            AutomationProperties.SetName(_closeDetailButton, "Close span detail");
            detailHeader.Children.Add(_detailTitle);
            detailHeader.Children.Add(_closeDetailButton);
            _detailType = new TextBlock { Text = "", FontSize = 12, Opacity = 0.7 };
            _detailDuration = new TextBlock { Text = "", FontSize = 12, Opacity = 0.7 };
            _detailContent = new TextBlock { Text = "", FontSize = 12, TextWrapping = TextWrapping.Wrap, IsTextSelectionEnabled = true };
            _detailPanel.Children.Add(detailHeader);
            _detailPanel.Children.Add(_detailType);
            _detailPanel.Children.Add(_detailDuration);
            _detailPanel.Children.Add(_detailContent);
            _root.Children.Add(_detailPanel);

            this.Content = _root;
            AutomationProperties.SetName(this, "Hierarchical execution trace viewer displaying LLM call spans");
        }

        public void AddNode(string name, string type, string duration, string content = null, int depth = 0, string status = "complete")
        {
            int typeIdx = Array.IndexOf(NodeTypes, type);
            string icon = typeIdx >= 0 ? NodeIcons[typeIdx] : "\u2022";

            var nodePanel = new StackPanel
            {
                Orientation = Orientation.Horizontal,
                Spacing = 8,
                Padding = new Thickness(depth * 16 + 4, 4, 4, 4)
            };

            var iconText = new TextBlock { Text = icon, FontSize = 12, VerticalAlignment = VerticalAlignment.Center };
            var nameText = new TextBlock { Text = name, FontSize = 13, VerticalAlignment = VerticalAlignment.Center };
            var durationBadge = new TextBlock { Text = duration, FontSize = 11, Opacity = 0.6, VerticalAlignment = VerticalAlignment.Center };

            nodePanel.Children.Add(iconText);
            nodePanel.Children.Add(nameText);

            if (status == "running")
            {
                var ring = new ProgressRing { IsActive = true, Width = 12, Height = 12 };
                nodePanel.Children.Add(ring);
            }
            else
            {
                nodePanel.Children.Add(durationBadge);
            }

            if (status == "error")
            {
                nameText.Foreground = new SolidColorBrush(Colors.Red);
            }

            int index = _treePanel.Children.Count;
            nodePanel.PointerPressed += (s, e) =>
            {
                _detailTitle.Text = name;
                _detailType.Text = $"Type: {type}";
                _detailDuration.Text = $"Duration: {duration}";
                _detailContent.Text = content ?? "";
                Send(WidgetEvent.SelectNode);
                OnNodeSelect?.Invoke(index);
            };

            AutomationProperties.SetName(nodePanel, $"Trace span: {name} ({type}) - {duration}");
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
            WidgetState.Idle when evt == WidgetEvent.Filter => WidgetState.Filtering,
            WidgetState.Idle when evt == WidgetEvent.Search => WidgetState.Searching,
            WidgetState.NodeSelected when evt == WidgetEvent.Deselect => WidgetState.Idle,
            WidgetState.NodeSelected when evt == WidgetEvent.SelectNode => WidgetState.NodeSelected,
            WidgetState.Filtering when evt == WidgetEvent.ClearFilter => WidgetState.Idle,
            WidgetState.Filtering when evt == WidgetEvent.SelectNode => WidgetState.NodeSelected,
            WidgetState.Searching when evt == WidgetEvent.ClearSearch => WidgetState.Idle,
            WidgetState.Searching when evt == WidgetEvent.SelectNode => WidgetState.NodeSelected,
            _ => state
        };
    }
}
