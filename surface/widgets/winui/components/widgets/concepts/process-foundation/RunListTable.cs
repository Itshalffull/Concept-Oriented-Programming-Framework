using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System;

namespace Clef.Surface.Widgets.Concepts.ProcessFoundation
{
    public sealed partial class RunListTable : UserControl
    {
        private enum WidgetState { Idle, RowSelected, Filtering, Sorting }
        private enum WidgetEvent { SelectRow, Deselect, Filter, ClearFilter, Sort }

        private WidgetState _state = WidgetState.Idle;
        private readonly StackPanel _root;
        private readonly TextBlock _title;
        private readonly StackPanel _toolbar;
        private readonly ComboBox _statusFilter;
        private readonly TextBox _searchInput;
        private readonly ScrollViewer _scrollViewer;
        private readonly StackPanel _tablePanel;
        private readonly StackPanel _headerRow;
        private readonly StackPanel _detailPanel;
        private readonly TextBlock _detailRunId;
        private readonly TextBlock _detailStatus;
        private readonly TextBlock _detailStarted;
        private readonly TextBlock _detailDuration;
        private readonly TextBlock _detailTrigger;
        private readonly Button _closeDetailButton;
        private int _selectedIndex = -1;

        public event Action<int> OnRowSelect;
        public event Action<string> OnFilterChange;

        public RunListTable()
        {
            _root = new StackPanel { Orientation = Orientation.Vertical, Spacing = 8, Padding = new Thickness(12) };

            // Header
            _title = new TextBlock { Text = "Process Runs", FontSize = 16, FontWeight = Microsoft.UI.Text.FontWeights.Bold };
            _root.Children.Add(_title);

            // Toolbar
            _toolbar = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            _statusFilter = new ComboBox { Width = 120 };
            _statusFilter.Items.Add("All");
            _statusFilter.Items.Add("Running");
            _statusFilter.Items.Add("Complete");
            _statusFilter.Items.Add("Failed");
            _statusFilter.Items.Add("Cancelled");
            _statusFilter.SelectedIndex = 0;
            _statusFilter.SelectionChanged += (s, e) =>
            {
                string selected = _statusFilter.SelectedItem?.ToString();
                if (selected != "All")
                    Send(WidgetEvent.Filter);
                else
                    Send(WidgetEvent.ClearFilter);
                OnFilterChange?.Invoke(selected);
            };
            AutomationProperties.SetName(_statusFilter, "Filter by status");

            _searchInput = new TextBox { PlaceholderText = "Search runs...", Width = 180 };
            AutomationProperties.SetName(_searchInput, "Search runs");
            _toolbar.Children.Add(_statusFilter);
            _toolbar.Children.Add(_searchInput);
            _root.Children.Add(_toolbar);

            // Table header
            _headerRow = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 16, Padding = new Thickness(8, 4, 8, 4) };
            _headerRow.Children.Add(CreateHeaderCell("Run ID", 100));
            _headerRow.Children.Add(CreateHeaderCell("Status", 80));
            _headerRow.Children.Add(CreateHeaderCell("Started", 120));
            _headerRow.Children.Add(CreateHeaderCell("Duration", 80));
            _headerRow.Children.Add(CreateHeaderCell("Trigger", 80));
            _root.Children.Add(_headerRow);

            // Table rows
            _tablePanel = new StackPanel { Orientation = Orientation.Vertical, Spacing = 1 };
            _scrollViewer = new ScrollViewer { Content = _tablePanel, MaxHeight = 400 };
            _root.Children.Add(_scrollViewer);

            // Detail panel (hidden)
            _detailPanel = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4, Visibility = Visibility.Collapsed, Padding = new Thickness(8) };
            var detailHeader = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            _detailRunId = new TextBlock { Text = "", FontSize = 14, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
            _closeDetailButton = new Button { Content = "\u2715", FontSize = 11 };
            _closeDetailButton.Click += (s, e) => Send(WidgetEvent.Deselect);
            AutomationProperties.SetName(_closeDetailButton, "Close detail");
            detailHeader.Children.Add(_detailRunId);
            detailHeader.Children.Add(_closeDetailButton);
            _detailStatus = new TextBlock { Text = "", FontSize = 12 };
            _detailStarted = new TextBlock { Text = "", FontSize = 12, Opacity = 0.7 };
            _detailDuration = new TextBlock { Text = "", FontSize = 12, Opacity = 0.7 };
            _detailTrigger = new TextBlock { Text = "", FontSize = 12, Opacity = 0.7 };
            _detailPanel.Children.Add(detailHeader);
            _detailPanel.Children.Add(_detailStatus);
            _detailPanel.Children.Add(_detailStarted);
            _detailPanel.Children.Add(_detailDuration);
            _detailPanel.Children.Add(_detailTrigger);
            _root.Children.Add(_detailPanel);

            this.Content = _root;
            AutomationProperties.SetName(this, "Table listing process runs with status, duration, and trigger information");
        }

        private TextBlock CreateHeaderCell(string text, double width)
        {
            return new TextBlock
            {
                Text = text,
                FontSize = 12,
                FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
                Width = width,
                Opacity = 0.7
            };
        }

        public void AddRun(string runId, string status, string started, string duration, string trigger)
        {
            var row = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 16, Padding = new Thickness(8, 6, 8, 6) };

            string statusIcon = status switch
            {
                "running" => "\u25CF",
                "complete" => "\u2713",
                "failed" => "\u2717",
                "cancelled" => "\u2014",
                _ => "\u25CB"
            };

            var statusColor = status switch
            {
                "running" => Colors.DodgerBlue,
                "complete" => Colors.Green,
                "failed" => Colors.Red,
                _ => Colors.Gray
            };

            row.Children.Add(new TextBlock { Text = runId, FontSize = 12, Width = 100 });
            row.Children.Add(new TextBlock { Text = $"{statusIcon} {status}", FontSize = 12, Width = 80, Foreground = new SolidColorBrush(statusColor) });
            row.Children.Add(new TextBlock { Text = started, FontSize = 12, Width = 120 });
            row.Children.Add(new TextBlock { Text = duration, FontSize = 12, Width = 80 });
            row.Children.Add(new TextBlock { Text = trigger, FontSize = 12, Width = 80 });

            int index = _tablePanel.Children.Count;
            row.PointerPressed += (s, e) =>
            {
                _selectedIndex = index;
                _detailRunId.Text = $"Run: {runId}";
                _detailStatus.Text = $"Status: {status}";
                _detailStarted.Text = $"Started: {started}";
                _detailDuration.Text = $"Duration: {duration}";
                _detailTrigger.Text = $"Trigger: {trigger}";
                Send(WidgetEvent.SelectRow);
                OnRowSelect?.Invoke(index);
            };

            AutomationProperties.SetName(row, $"Run {runId}: {status}");
            _tablePanel.Children.Add(row);
        }

        public void Send(WidgetEvent evt)
        {
            _state = Reduce(_state, evt);
            _detailPanel.Visibility = _state == WidgetState.RowSelected ? Visibility.Visible : Visibility.Collapsed;
        }

        private WidgetState Reduce(WidgetState state, WidgetEvent evt) => state switch
        {
            WidgetState.Idle when evt == WidgetEvent.SelectRow => WidgetState.RowSelected,
            WidgetState.Idle when evt == WidgetEvent.Filter => WidgetState.Filtering,
            WidgetState.RowSelected when evt == WidgetEvent.Deselect => WidgetState.Idle,
            WidgetState.RowSelected when evt == WidgetEvent.SelectRow => WidgetState.RowSelected,
            WidgetState.Filtering when evt == WidgetEvent.ClearFilter => WidgetState.Idle,
            WidgetState.Filtering when evt == WidgetEvent.SelectRow => WidgetState.RowSelected,
            _ => state
        };
    }
}
