// ============================================================
// Clef Surface WinUI Widget — GraphAnalysisPanel
//
// Analysis panel for running graph algorithms on a canvas and
// visualizing results. Composes ClefCanvasPanel with category
// tabs (centrality, community, path, pattern, flow, structural,
// clustering), algorithm selection, run controls, score results
// table, overlay toggles, and report generation. Maps the
// graph-analysis-panel.widget spec to WinUI 3 UserControl.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;

namespace Clef.Surface.WinUI.Widgets.Domain;

public sealed class ClefGraphAnalysisPanel : UserControl
{
    public static readonly DependencyProperty CanvasIdProperty =
        DependencyProperty.Register(nameof(CanvasId), typeof(string), typeof(ClefGraphAnalysisPanel),
            new PropertyMetadata(""));

    public static readonly DependencyProperty SelectedCategoryProperty =
        DependencyProperty.Register(nameof(SelectedCategory), typeof(string), typeof(ClefGraphAnalysisPanel),
            new PropertyMetadata("centrality", OnPropertyChanged));

    public static readonly DependencyProperty SelectedAlgorithmProperty =
        DependencyProperty.Register(nameof(SelectedAlgorithm), typeof(string), typeof(ClefGraphAnalysisPanel),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty WorkflowStateProperty =
        DependencyProperty.Register(nameof(WorkflowState), typeof(string), typeof(ClefGraphAnalysisPanel),
            new PropertyMetadata("idle", OnPropertyChanged));

    public static readonly DependencyProperty OverlaysEnabledProperty =
        DependencyProperty.Register(nameof(OverlaysEnabled), typeof(bool), typeof(ClefGraphAnalysisPanel),
            new PropertyMetadata(false, OnPropertyChanged));

    public static readonly DependencyProperty ReportFormatProperty =
        DependencyProperty.Register(nameof(ReportFormat), typeof(string), typeof(ClefGraphAnalysisPanel),
            new PropertyMetadata("summary", OnPropertyChanged));

    public string CanvasId { get => (string)GetValue(CanvasIdProperty); set => SetValue(CanvasIdProperty, value); }
    public string SelectedCategory { get => (string)GetValue(SelectedCategoryProperty); set => SetValue(SelectedCategoryProperty, value); }
    public string SelectedAlgorithm { get => (string)GetValue(SelectedAlgorithmProperty); set => SetValue(SelectedAlgorithmProperty, value); }
    public string WorkflowState { get => (string)GetValue(WorkflowStateProperty); set => SetValue(WorkflowStateProperty, value); }
    public bool OverlaysEnabled { get => (bool)GetValue(OverlaysEnabledProperty); set => SetValue(OverlaysEnabledProperty, value); }
    public string ReportFormat { get => (string)GetValue(ReportFormatProperty); set => SetValue(ReportFormatProperty, value); }

    public event System.EventHandler<RunRequestedEventArgs> RunRequested;
    public event System.EventHandler<OverlayToggledEventArgs> OverlayToggled;
    public event System.EventHandler<ReportRequestedEventArgs> ReportRequested;
    public event System.EventHandler<ExportRequestedEventArgs> ExportRequested;
    public event System.EventHandler<CompareRequestedEventArgs> CompareRequested;

    private readonly ClefCanvasPanel _panel;
    private readonly Pivot _categoryPivot;
    private readonly ComboBox _algorithmSelector;
    private readonly Button _runButton;
    private readonly ProgressBar _progressBar;
    private readonly ListView _scoresTable;
    private readonly ToggleSwitch _masterOverlayToggle;
    private readonly StackPanel _overlayToggles;
    private readonly ComboBox _reportFormatSelector;
    private readonly Button _generateReportButton;
    private readonly Button _compareButton;
    private readonly StackPanel _bodyContent;

    public ClefGraphAnalysisPanel()
    {
        // Category pivot with 7 tabs
        _categoryPivot = new Pivot { Margin = new Thickness(0, 0, 0, 8) };
        var categories = new[]
        {
            ("centrality", "Centrality"),
            ("community", "Community"),
            ("path", "Path"),
            ("pattern", "Pattern"),
            ("flow", "Flow"),
            ("structural", "Structural"),
            ("clustering", "Clustering")
        };
        foreach (var (tag, label) in categories)
        {
            _categoryPivot.Items.Add(new PivotItem { Header = label, Tag = tag });
        }
        _categoryPivot.SelectionChanged += (s, e) =>
        {
            if (_categoryPivot.SelectedItem is PivotItem item)
            {
                SelectedCategory = item.Tag?.ToString() ?? "centrality";
            }
        };
        AutomationProperties.SetName(_categoryPivot, "Analysis category");

        // Algorithm selector within category
        _algorithmSelector = new ComboBox
        {
            Header = "Algorithm",
            HorizontalAlignment = HorizontalAlignment.Stretch,
            Margin = new Thickness(0, 0, 0, 8)
        };
        _algorithmSelector.SelectionChanged += (s, e) =>
        {
            if (_algorithmSelector.SelectedItem is ComboBoxItem item)
            {
                SelectedAlgorithm = item.Tag?.ToString();
            }
        };
        AutomationProperties.SetName(_algorithmSelector, "Algorithm");

        // Run analysis button
        _runButton = new Button
        {
            Content = "Run Analysis",
            HorizontalAlignment = HorizontalAlignment.Stretch,
            Margin = new Thickness(0, 0, 0, 4)
        };
        _runButton.Click += (s, e) =>
        {
            RunRequested?.Invoke(this, new RunRequestedEventArgs(SelectedCategory, SelectedAlgorithm));
        };
        AutomationProperties.SetName(_runButton, "Run analysis");

        // Progress bar (indeterminate, shown during running state)
        _progressBar = new ProgressBar
        {
            IsIndeterminate = true,
            Visibility = Visibility.Collapsed,
            Margin = new Thickness(0, 0, 0, 8)
        };
        AutomationProperties.SetName(_progressBar, "Analysis progress");

        // Scores table for results
        _scoresTable = new ListView
        {
            MaxHeight = 240,
            Margin = new Thickness(0, 0, 0, 12),
            SelectionMode = ListViewSelectionMode.None,
            Visibility = Visibility.Collapsed
        };
        AutomationProperties.SetName(_scoresTable, "Analysis scores");

        // Overlay controls section
        var overlayHeader = new TextBlock
        {
            Text = "Overlays",
            FontSize = 13,
            FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
            Margin = new Thickness(0, 4, 0, 4)
        };

        _masterOverlayToggle = new ToggleSwitch
        {
            Header = "Enable Overlays",
            IsOn = false,
            Margin = new Thickness(0, 0, 0, 4)
        };
        _masterOverlayToggle.Toggled += (s, e) =>
        {
            OverlaysEnabled = _masterOverlayToggle.IsOn;
            OverlayToggled?.Invoke(this, new OverlayToggledEventArgs("master", _masterOverlayToggle.IsOn));
        };
        AutomationProperties.SetName(_masterOverlayToggle, "Enable overlays");

        _overlayToggles = new StackPanel
        {
            Spacing = 4,
            Margin = new Thickness(12, 0, 0, 8)
        };
        AutomationProperties.SetName(_overlayToggles, "Overlay options");

        // Report section
        var reportHeader = new TextBlock
        {
            Text = "Reports",
            FontSize = 13,
            FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
            Margin = new Thickness(0, 4, 0, 4)
        };

        _reportFormatSelector = new ComboBox
        {
            Header = "Format",
            HorizontalAlignment = HorizontalAlignment.Stretch,
            Margin = new Thickness(0, 0, 0, 8)
        };
        _reportFormatSelector.Items.Add(new ComboBoxItem { Content = "Summary", Tag = "summary" });
        _reportFormatSelector.Items.Add(new ComboBoxItem { Content = "Detailed", Tag = "detailed" });
        _reportFormatSelector.Items.Add(new ComboBoxItem { Content = "CSV", Tag = "csv" });
        _reportFormatSelector.Items.Add(new ComboBoxItem { Content = "JSON", Tag = "json" });
        _reportFormatSelector.SelectedIndex = 0;
        _reportFormatSelector.SelectionChanged += (s, e) =>
        {
            if (_reportFormatSelector.SelectedItem is ComboBoxItem item)
            {
                ReportFormat = item.Tag?.ToString() ?? "summary";
            }
        };
        AutomationProperties.SetName(_reportFormatSelector, "Report format");

        _generateReportButton = new Button
        {
            Content = "Generate Report",
            HorizontalAlignment = HorizontalAlignment.Stretch,
            Margin = new Thickness(0, 0, 0, 4)
        };
        _generateReportButton.Click += (s, e) =>
        {
            ReportRequested?.Invoke(this, new ReportRequestedEventArgs(ReportFormat, SelectedCategory, SelectedAlgorithm));
        };
        AutomationProperties.SetName(_generateReportButton, "Generate report");

        _compareButton = new Button
        {
            Content = "Compare",
            HorizontalAlignment = HorizontalAlignment.Stretch,
            Margin = new Thickness(0, 0, 0, 4)
        };
        _compareButton.Click += (s, e) =>
        {
            CompareRequested?.Invoke(this, new CompareRequestedEventArgs(SelectedCategory, SelectedAlgorithm));
        };
        AutomationProperties.SetName(_compareButton, "Compare results");

        // Assemble body content
        _bodyContent = new StackPanel { Spacing = 4, Padding = new Thickness(8) };
        _bodyContent.Children.Add(_categoryPivot);
        _bodyContent.Children.Add(_algorithmSelector);
        _bodyContent.Children.Add(_runButton);
        _bodyContent.Children.Add(_progressBar);
        _bodyContent.Children.Add(_scoresTable);
        _bodyContent.Children.Add(overlayHeader);
        _bodyContent.Children.Add(_masterOverlayToggle);
        _bodyContent.Children.Add(_overlayToggles);
        _bodyContent.Children.Add(reportHeader);
        _bodyContent.Children.Add(_reportFormatSelector);
        _bodyContent.Children.Add(_generateReportButton);
        _bodyContent.Children.Add(_compareButton);

        // Wrap in a ClefCanvasPanel
        _panel = new ClefCanvasPanel
        {
            Title = "Graph Analysis",
            Dock = "right",
            DefaultWidth = 340,
            IsCollapsible = true,
            PanelState = "expanded"
        };
        _panel.SetPanelContent(_bodyContent);

        AutomationProperties.SetName(_panel, "Graph analysis panel");
        Content = _panel;
        UpdateVisual();
    }

    /// <summary>
    /// Sets the algorithms available for the currently selected category.
    /// </summary>
    public void SetAlgorithms(System.Collections.Generic.IEnumerable<(string Name, string Label)> algorithms)
    {
        _algorithmSelector.Items.Clear();
        foreach (var (name, label) in algorithms)
        {
            _algorithmSelector.Items.Add(new ComboBoxItem { Content = label, Tag = name });
        }
    }

    /// <summary>
    /// Sets the overlay toggles available for the current analysis results.
    /// </summary>
    public void SetOverlays(System.Collections.Generic.IEnumerable<(string Name, string Label, bool IsOn)> overlays)
    {
        _overlayToggles.Children.Clear();
        foreach (var (name, label, isOn) in overlays)
        {
            var toggle = new ToggleSwitch
            {
                Header = label,
                IsOn = isOn,
                Tag = name
            };
            toggle.Toggled += (s, e) =>
            {
                OverlayToggled?.Invoke(this, new OverlayToggledEventArgs(
                    toggle.Tag?.ToString() ?? name, toggle.IsOn));
            };
            AutomationProperties.SetName(toggle, label);
            _overlayToggles.Children.Add(toggle);
        }
    }

    /// <summary>
    /// Sets the score results to display in the scores table.
    /// </summary>
    public void SetScores(System.Collections.Generic.IEnumerable<(string Label, double Score)> scores)
    {
        _scoresTable.Items.Clear();
        foreach (var (label, score) in scores)
        {
            var row = new Grid();
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            var labelBlock = new TextBlock { Text = label, VerticalAlignment = VerticalAlignment.Center };
            var scoreBlock = new TextBlock
            {
                Text = score.ToString("F4"),
                VerticalAlignment = VerticalAlignment.Center,
                Opacity = 0.7
            };
            Grid.SetColumn(labelBlock, 0);
            Grid.SetColumn(scoreBlock, 1);
            row.Children.Add(labelBlock);
            row.Children.Add(scoreBlock);

            _scoresTable.Items.Add(row);
        }

        _scoresTable.Visibility = _scoresTable.Items.Count > 0
            ? Visibility.Visible
            : Visibility.Collapsed;
    }

    /// <summary>
    /// Raises the ExportRequested event programmatically.
    /// </summary>
    public void RequestExport(string format)
    {
        ExportRequested?.Invoke(this, new ExportRequestedEventArgs(format, SelectedCategory, SelectedAlgorithm));
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefGraphAnalysisPanel)d).UpdateVisual();

    private void UpdateVisual()
    {
        // Run button enabled only when an algorithm is selected and not currently running
        var isRunning = WorkflowState == "running";
        _runButton.IsEnabled = !string.IsNullOrEmpty(SelectedAlgorithm) && !isRunning;
        _runButton.Content = isRunning ? "Running..." : "Run Analysis";

        // Progress bar visible during running state
        _progressBar.Visibility = isRunning ? Visibility.Visible : Visibility.Collapsed;

        // Scores table visible when results are available
        var hasResults = WorkflowState == "showingResults"
                      || WorkflowState == "showingReport"
                      || WorkflowState == "comparing";
        _scoresTable.Visibility = hasResults && _scoresTable.Items.Count > 0
            ? Visibility.Visible
            : Visibility.Collapsed;

        // Overlay master toggle sync
        _masterOverlayToggle.IsOn = OverlaysEnabled;
        _overlayToggles.Visibility = OverlaysEnabled ? Visibility.Visible : Visibility.Collapsed;

        // Report controls visible when results exist
        var reportVisible = hasResults ? Visibility.Visible : Visibility.Collapsed;
        _reportFormatSelector.Visibility = reportVisible;
        _generateReportButton.Visibility = reportVisible;
        _compareButton.Visibility = reportVisible;

        // Sync report format selector
        foreach (ComboBoxItem item in _reportFormatSelector.Items)
        {
            if (item.Tag?.ToString() == ReportFormat)
            {
                _reportFormatSelector.SelectedItem = item;
                break;
            }
        }

        // Sync category pivot selection
        foreach (PivotItem item in _categoryPivot.Items)
        {
            if (item.Tag?.ToString() == SelectedCategory)
            {
                _categoryPivot.SelectedItem = item;
                break;
            }
        }
    }

    public record RunRequestedEventArgs(string Category, string Algorithm);
    public record OverlayToggledEventArgs(string OverlayName, bool IsEnabled);
    public record ReportRequestedEventArgs(string Format, string Category, string Algorithm);
    public record ExportRequestedEventArgs(string Format, string Category, string Algorithm);
    public record CompareRequestedEventArgs(string Category, string Algorithm);
}
