using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System;

namespace Clef.Surface.Widgets.Concepts.ProcessLlm
{
    public sealed partial class EvalResultsTable : UserControl
    {
        private enum WidgetState { Idle, RowSelected, Sorting, Filtering }
        private enum WidgetEvent { SelectRow, Deselect, Sort, Filter, ClearFilter }

        private WidgetState _state = WidgetState.Idle;
        private readonly StackPanel _root;
        private readonly TextBlock _title;
        private readonly StackPanel _toolbar;
        private readonly ComboBox _metricFilter;
        private readonly ComboBox _statusFilter;
        private readonly TextBlock _summaryText;
        private readonly StackPanel _headerRow;
        private readonly ScrollViewer _scrollViewer;
        private readonly StackPanel _tablePanel;
        private readonly StackPanel _detailPanel;
        private readonly TextBlock _detailInput;
        private readonly TextBlock _detailExpected;
        private readonly TextBlock _detailActual;
        private readonly TextBlock _detailScore;
        private readonly TextBlock _detailMetrics;
        private readonly Button _closeDetailButton;
        private int _selectedIndex = -1;

        public event Action<int> OnRowSelect;

        public EvalResultsTable()
        {
            _root = new StackPanel { Orientation = Orientation.Vertical, Spacing = 8, Padding = new Thickness(12) };

            // Header
            _title = new TextBlock { Text = "Evaluation Results", FontSize = 16, FontWeight = Microsoft.UI.Text.FontWeights.Bold };
            _root.Children.Add(_title);

            // Toolbar
            _toolbar = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            _metricFilter = new ComboBox { Width = 120 };
            _metricFilter.Items.Add("All Metrics");
            _metricFilter.Items.Add("Accuracy");
            _metricFilter.Items.Add("Relevance");
            _metricFilter.Items.Add("Faithfulness");
            _metricFilter.Items.Add("Toxicity");
            _metricFilter.SelectedIndex = 0;
            AutomationProperties.SetName(_metricFilter, "Filter by metric");
            _metricFilter.SelectionChanged += (s, e) =>
            {
                if (_metricFilter.SelectedIndex > 0) Send(WidgetEvent.Filter);
                else Send(WidgetEvent.ClearFilter);
            };

            _statusFilter = new ComboBox { Width = 100 };
            _statusFilter.Items.Add("All");
            _statusFilter.Items.Add("Pass");
            _statusFilter.Items.Add("Fail");
            _statusFilter.SelectedIndex = 0;
            AutomationProperties.SetName(_statusFilter, "Filter by status");

            _summaryText = new TextBlock { Text = "", FontSize = 12, Opacity = 0.7, VerticalAlignment = VerticalAlignment.Center };

            _toolbar.Children.Add(_metricFilter);
            _toolbar.Children.Add(_statusFilter);
            _toolbar.Children.Add(_summaryText);
            _root.Children.Add(_toolbar);

            // Table header
            _headerRow = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 12, Padding = new Thickness(8, 4, 8, 4) };
            _headerRow.Children.Add(new TextBlock { Text = "#", FontSize = 12, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold, Width = 30, Opacity = 0.7 });
            _headerRow.Children.Add(new TextBlock { Text = "Input", FontSize = 12, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold, Width = 150, Opacity = 0.7 });
            _headerRow.Children.Add(new TextBlock { Text = "Score", FontSize = 12, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold, Width = 60, Opacity = 0.7 });
            _headerRow.Children.Add(new TextBlock { Text = "Status", FontSize = 12, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold, Width = 60, Opacity = 0.7 });
            _headerRow.Children.Add(new TextBlock { Text = "Duration", FontSize = 12, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold, Width = 70, Opacity = 0.7 });
            _root.Children.Add(_headerRow);

            // Table rows
            _tablePanel = new StackPanel { Orientation = Orientation.Vertical, Spacing = 1 };
            _scrollViewer = new ScrollViewer { Content = _tablePanel, MaxHeight = 400 };
            _root.Children.Add(_scrollViewer);

            // Detail panel (hidden)
            _detailPanel = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4, Visibility = Visibility.Collapsed, Padding = new Thickness(8) };
            var detailHeader = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            detailHeader.Children.Add(new TextBlock { Text = "Result Detail", FontSize = 14, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold });
            _closeDetailButton = new Button { Content = "\u2715", FontSize = 11 };
            _closeDetailButton.Click += (s, e) => Send(WidgetEvent.Deselect);
            AutomationProperties.SetName(_closeDetailButton, "Close detail");
            detailHeader.Children.Add(_closeDetailButton);
            _detailInput = new TextBlock { Text = "", FontSize = 12, TextWrapping = TextWrapping.Wrap };
            _detailExpected = new TextBlock { Text = "", FontSize = 12, TextWrapping = TextWrapping.Wrap, Opacity = 0.8 };
            _detailActual = new TextBlock { Text = "", FontSize = 12, TextWrapping = TextWrapping.Wrap };
            _detailScore = new TextBlock { Text = "", FontSize = 13, FontWeight = Microsoft.UI.Text.FontWeights.Bold };
            _detailMetrics = new TextBlock { Text = "", FontSize = 12, Opacity = 0.7, TextWrapping = TextWrapping.Wrap };
            _detailPanel.Children.Add(detailHeader);
            _detailPanel.Children.Add(_detailInput);
            _detailPanel.Children.Add(_detailExpected);
            _detailPanel.Children.Add(_detailActual);
            _detailPanel.Children.Add(_detailScore);
            _detailPanel.Children.Add(_detailMetrics);
            _root.Children.Add(_detailPanel);

            this.Content = _root;
            AutomationProperties.SetName(this, "Results table for LLM evaluation runs showing scores and pass/fail status");
        }

        public void SetSummary(int total, int passed, double avgScore)
        {
            _summaryText.Text = $"{passed}/{total} passed, avg score: {avgScore:F2}";
        }

        public void AddResult(int index, string input, string expected, string actual, double score, bool passed, string duration, string metrics = null)
        {
            var row = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 12, Padding = new Thickness(8, 6, 8, 6) };

            row.Children.Add(new TextBlock { Text = (index + 1).ToString(), FontSize = 12, Width = 30 });
            row.Children.Add(new TextBlock { Text = input, FontSize = 12, Width = 150, MaxLines = 1, TextTrimming = TextTrimming.CharacterEllipsis });
            row.Children.Add(new TextBlock { Text = $"{score:F2}", FontSize = 12, Width = 60, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold });
            row.Children.Add(new TextBlock
            {
                Text = passed ? "\u2713 Pass" : "\u2717 Fail",
                FontSize = 12,
                Width = 60,
                Foreground = new SolidColorBrush(passed ? Colors.Green : Colors.Red)
            });
            row.Children.Add(new TextBlock { Text = duration, FontSize = 12, Width = 70, Opacity = 0.7 });

            int rowIndex = _tablePanel.Children.Count;
            row.PointerPressed += (s, e) =>
            {
                _selectedIndex = rowIndex;
                _detailInput.Text = $"Input: {input}";
                _detailExpected.Text = $"Expected: {expected}";
                _detailActual.Text = $"Actual: {actual}";
                _detailScore.Text = $"Score: {score:F2}";
                _detailScore.Foreground = new SolidColorBrush(passed ? Colors.Green : Colors.Red);
                _detailMetrics.Text = metrics ?? "";
                Send(WidgetEvent.SelectRow);
                OnRowSelect?.Invoke(rowIndex);
            };

            AutomationProperties.SetName(row, $"Result {index + 1}: {(passed ? "pass" : "fail")} score {score:F2}");
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
            WidgetState.Idle when evt == WidgetEvent.Sort => WidgetState.Sorting,
            WidgetState.Idle when evt == WidgetEvent.Filter => WidgetState.Filtering,
            WidgetState.RowSelected when evt == WidgetEvent.Deselect => WidgetState.Idle,
            WidgetState.RowSelected when evt == WidgetEvent.SelectRow => WidgetState.RowSelected,
            WidgetState.Sorting when evt == WidgetEvent.SelectRow => WidgetState.RowSelected,
            WidgetState.Filtering when evt == WidgetEvent.ClearFilter => WidgetState.Idle,
            WidgetState.Filtering when evt == WidgetEvent.SelectRow => WidgetState.RowSelected,
            _ => state
        };
    }
}
