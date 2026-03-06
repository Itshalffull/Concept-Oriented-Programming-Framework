using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System;

namespace Clef.Surface.Widgets.Concepts.Package
{
    public sealed partial class AuditReport : UserControl
    {
        private enum WidgetState { Idle, Scanning, Viewing, DetailView }
        private enum WidgetEvent { Scan, ScanComplete, ScanFail, SelectVulnerability, Deselect, Reset }

        private WidgetState _state = WidgetState.Idle;
        private readonly StackPanel _root;
        private readonly TextBlock _title;
        private readonly StackPanel _summaryPanel;
        private readonly TextBlock _criticalCount;
        private readonly TextBlock _highCount;
        private readonly TextBlock _mediumCount;
        private readonly TextBlock _lowCount;
        private readonly Button _scanButton;
        private readonly ProgressRing _scanRing;
        private readonly ScrollViewer _scrollViewer;
        private readonly StackPanel _vulnerabilityList;
        private readonly StackPanel _detailPanel;
        private readonly TextBlock _detailTitle;
        private readonly TextBlock _detailSeverity;
        private readonly TextBlock _detailDescription;
        private readonly TextBlock _detailRemediation;
        private readonly Button _closeDetailButton;

        public event Action OnScan;

        public AuditReport()
        {
            _root = new StackPanel { Orientation = Orientation.Vertical, Spacing = 8, Padding = new Thickness(12) };

            // Header
            var header = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            _title = new TextBlock { Text = "Security Audit Report", FontSize = 16, FontWeight = Microsoft.UI.Text.FontWeights.Bold, VerticalAlignment = VerticalAlignment.Center };
            _scanButton = new Button { Content = "Run Scan" };
            _scanButton.Click += (s, e) =>
            {
                Send(WidgetEvent.Scan);
                OnScan?.Invoke();
            };
            AutomationProperties.SetName(_scanButton, "Run security scan");
            _scanRing = new ProgressRing { IsActive = false, Width = 16, Height = 16, Visibility = Visibility.Collapsed };
            header.Children.Add(_title);
            header.Children.Add(_scanButton);
            header.Children.Add(_scanRing);
            _root.Children.Add(header);

            // Summary
            _summaryPanel = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 16, Visibility = Visibility.Collapsed };
            _criticalCount = new TextBlock { Text = "0 Critical", FontSize = 13, Foreground = new SolidColorBrush(Colors.Red), FontWeight = Microsoft.UI.Text.FontWeights.Bold };
            _highCount = new TextBlock { Text = "0 High", FontSize = 13, Foreground = new SolidColorBrush(Colors.OrangeRed) };
            _mediumCount = new TextBlock { Text = "0 Medium", FontSize = 13, Foreground = new SolidColorBrush(Colors.Orange) };
            _lowCount = new TextBlock { Text = "0 Low", FontSize = 13, Foreground = new SolidColorBrush(Colors.Green) };
            _summaryPanel.Children.Add(_criticalCount);
            _summaryPanel.Children.Add(_highCount);
            _summaryPanel.Children.Add(_mediumCount);
            _summaryPanel.Children.Add(_lowCount);
            _root.Children.Add(_summaryPanel);

            // Vulnerability list
            _vulnerabilityList = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4 };
            _scrollViewer = new ScrollViewer { Content = _vulnerabilityList, MaxHeight = 400 };
            _root.Children.Add(_scrollViewer);

            // Detail panel (hidden)
            _detailPanel = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4, Visibility = Visibility.Collapsed, Padding = new Thickness(8) };
            var detailHeader = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            _detailTitle = new TextBlock { Text = "", FontSize = 14, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
            _closeDetailButton = new Button { Content = "\u2715", FontSize = 11 };
            _closeDetailButton.Click += (s, e) => Send(WidgetEvent.Deselect);
            AutomationProperties.SetName(_closeDetailButton, "Close detail");
            detailHeader.Children.Add(_detailTitle);
            detailHeader.Children.Add(_closeDetailButton);
            _detailSeverity = new TextBlock { Text = "", FontSize = 12 };
            _detailDescription = new TextBlock { Text = "", FontSize = 12, TextWrapping = TextWrapping.Wrap };
            _detailRemediation = new TextBlock { Text = "", FontSize = 12, TextWrapping = TextWrapping.Wrap, Opacity = 0.8 };
            _detailPanel.Children.Add(detailHeader);
            _detailPanel.Children.Add(_detailSeverity);
            _detailPanel.Children.Add(_detailDescription);
            _detailPanel.Children.Add(_detailRemediation);
            _root.Children.Add(_detailPanel);

            this.Content = _root;
            AutomationProperties.SetName(this, "Security audit report panel showing vulnerability findings");
        }

        public void SetSummary(int critical, int high, int medium, int low)
        {
            _criticalCount.Text = $"{critical} Critical";
            _highCount.Text = $"{high} High";
            _mediumCount.Text = $"{medium} Medium";
            _lowCount.Text = $"{low} Low";
            _summaryPanel.Visibility = Visibility.Visible;
        }

        public void AddVulnerability(string name, string severity, string description, string remediation = null)
        {
            var item = new Border { Padding = new Thickness(8), CornerRadius = new CornerRadius(4), BorderThickness = new Thickness(1), BorderBrush = new SolidColorBrush(Colors.Gray) };
            var content = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };

            var sevColor = severity switch
            {
                "critical" => Colors.Red,
                "high" => Colors.OrangeRed,
                "medium" => Colors.Orange,
                _ => Colors.Green
            };
            var sevDot = new TextBlock { Text = "\u25CF", Foreground = new SolidColorBrush(sevColor), VerticalAlignment = VerticalAlignment.Center };
            var nameText = new TextBlock { Text = name, FontSize = 13, VerticalAlignment = VerticalAlignment.Center };
            var sevText = new TextBlock { Text = severity, FontSize = 11, Opacity = 0.7, VerticalAlignment = VerticalAlignment.Center };

            content.Children.Add(sevDot);
            content.Children.Add(nameText);
            content.Children.Add(sevText);
            item.Child = content;

            item.PointerPressed += (s, e) =>
            {
                _detailTitle.Text = name;
                _detailSeverity.Text = $"Severity: {severity}";
                _detailSeverity.Foreground = new SolidColorBrush(sevColor);
                _detailDescription.Text = description;
                _detailRemediation.Text = remediation != null ? $"Fix: {remediation}" : "";
                Send(WidgetEvent.SelectVulnerability);
            };

            AutomationProperties.SetName(item, $"Vulnerability: {name} ({severity})");
            _vulnerabilityList.Children.Add(item);
        }

        public void ScanComplete()
        {
            Send(WidgetEvent.ScanComplete);
        }

        public void Send(WidgetEvent evt)
        {
            _state = Reduce(_state, evt);
            UpdateVisuals();
        }

        private void UpdateVisuals()
        {
            _scanRing.IsActive = _state == WidgetState.Scanning;
            _scanRing.Visibility = _state == WidgetState.Scanning ? Visibility.Visible : Visibility.Collapsed;
            _scanButton.IsEnabled = _state != WidgetState.Scanning;
            _scanButton.Content = _state == WidgetState.Scanning ? "Scanning..." : "Run Scan";
            _detailPanel.Visibility = _state == WidgetState.DetailView ? Visibility.Visible : Visibility.Collapsed;
        }

        private WidgetState Reduce(WidgetState state, WidgetEvent evt) => state switch
        {
            WidgetState.Idle when evt == WidgetEvent.Scan => WidgetState.Scanning,
            WidgetState.Scanning when evt == WidgetEvent.ScanComplete => WidgetState.Viewing,
            WidgetState.Scanning when evt == WidgetEvent.ScanFail => WidgetState.Idle,
            WidgetState.Viewing when evt == WidgetEvent.SelectVulnerability => WidgetState.DetailView,
            WidgetState.Viewing when evt == WidgetEvent.Scan => WidgetState.Scanning,
            WidgetState.DetailView when evt == WidgetEvent.Deselect => WidgetState.Viewing,
            WidgetState.DetailView when evt == WidgetEvent.SelectVulnerability => WidgetState.DetailView,
            _ => state
        };
    }
}
