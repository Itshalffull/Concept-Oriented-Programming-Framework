using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System;

namespace Clef.Surface.Widgets.Concepts.LlmConversation
{
    public sealed partial class ArtifactPanel : UserControl
    {
        private enum WidgetState { Open, Collapsed, Fullscreen, Loading }
        private enum WidgetEvent { Toggle, Fullscreen, ExitFullscreen, Load, LoadComplete }

        private WidgetState _state = WidgetState.Open;
        private readonly Grid _root;
        private readonly StackPanel _header;
        private readonly TextBlock _title;
        private readonly TextBlock _typeBadge;
        private readonly StackPanel _headerActions;
        private readonly Button _toggleButton;
        private readonly Button _fullscreenButton;
        private readonly Button _copyButton;
        private readonly Button _downloadButton;
        private readonly ScrollViewer _contentScroll;
        private readonly StackPanel _contentPanel;
        private readonly ProgressRing _loadingRing;
        private readonly StackPanel _versionBar;
        private readonly TextBlock _versionText;
        private readonly Button _prevVersion;
        private readonly Button _nextVersion;
        private int _currentVersion = 1;
        private int _totalVersions = 1;

        public event Action OnCopy;
        public event Action OnDownload;
        public event Action<int> OnVersionChange;

        public ArtifactPanel()
        {
            _root = new Grid();
            var mainPanel = new StackPanel { Orientation = Orientation.Vertical, Spacing = 8, Padding = new Thickness(12) };

            // Header
            _header = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            _title = new TextBlock { Text = "Artifact", FontSize = 14, FontWeight = Microsoft.UI.Text.FontWeights.Bold, VerticalAlignment = VerticalAlignment.Center };
            _typeBadge = new TextBlock { Text = "code", FontSize = 11, Opacity = 0.7, VerticalAlignment = VerticalAlignment.Center };

            _headerActions = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            _toggleButton = new Button { Content = "\u25BC", FontSize = 11 };
            _toggleButton.Click += (s, e) => Send(WidgetEvent.Toggle);
            AutomationProperties.SetName(_toggleButton, "Toggle artifact panel");

            _fullscreenButton = new Button { Content = "\u2922", FontSize = 11 };
            _fullscreenButton.Click += (s, e) => Send(_state == WidgetState.Fullscreen ? WidgetEvent.ExitFullscreen : WidgetEvent.Fullscreen);
            AutomationProperties.SetName(_fullscreenButton, "Toggle fullscreen");

            _copyButton = new Button { Content = "\u2398 Copy", FontSize = 11 };
            _copyButton.Click += (s, e) => OnCopy?.Invoke();
            AutomationProperties.SetName(_copyButton, "Copy artifact content");

            _downloadButton = new Button { Content = "\u2913 Download", FontSize = 11 };
            _downloadButton.Click += (s, e) => OnDownload?.Invoke();
            AutomationProperties.SetName(_downloadButton, "Download artifact");

            _headerActions.Children.Add(_copyButton);
            _headerActions.Children.Add(_downloadButton);
            _headerActions.Children.Add(_fullscreenButton);
            _headerActions.Children.Add(_toggleButton);

            _header.Children.Add(_title);
            _header.Children.Add(_typeBadge);
            _header.Children.Add(_headerActions);
            mainPanel.Children.Add(_header);

            // Version bar
            _versionBar = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4, Visibility = Visibility.Collapsed };
            _prevVersion = new Button { Content = "\u2190", FontSize = 11 };
            _prevVersion.Click += (s, e) =>
            {
                if (_currentVersion > 1) { _currentVersion--; UpdateVersionDisplay(); OnVersionChange?.Invoke(_currentVersion); }
            };
            AutomationProperties.SetName(_prevVersion, "Previous version");
            _versionText = new TextBlock { Text = "v1 / 1", FontSize = 11, VerticalAlignment = VerticalAlignment.Center };
            _nextVersion = new Button { Content = "\u2192", FontSize = 11 };
            _nextVersion.Click += (s, e) =>
            {
                if (_currentVersion < _totalVersions) { _currentVersion++; UpdateVersionDisplay(); OnVersionChange?.Invoke(_currentVersion); }
            };
            AutomationProperties.SetName(_nextVersion, "Next version");
            _versionBar.Children.Add(_prevVersion);
            _versionBar.Children.Add(_versionText);
            _versionBar.Children.Add(_nextVersion);
            mainPanel.Children.Add(_versionBar);

            // Content area
            _contentPanel = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4 };
            _contentScroll = new ScrollViewer { Content = _contentPanel, MaxHeight = 500 };
            mainPanel.Children.Add(_contentScroll);

            // Loading indicator
            _loadingRing = new ProgressRing { IsActive = false, Width = 24, Height = 24, Visibility = Visibility.Collapsed };
            mainPanel.Children.Add(_loadingRing);

            _root.Children.Add(mainPanel);
            this.Content = _root;
            AutomationProperties.SetName(this, "Side panel for displaying and interacting with generated artifacts");
        }

        public void SetArtifact(string title, string type, string content)
        {
            _title.Text = title;
            _typeBadge.Text = type;
            _contentPanel.Children.Clear();
            var text = new TextBlock { Text = content, FontSize = 13, TextWrapping = TextWrapping.Wrap, IsTextSelectionEnabled = true };
            _contentPanel.Children.Add(text);
        }

        public void SetVersions(int current, int total)
        {
            _currentVersion = current;
            _totalVersions = total;
            _versionBar.Visibility = total > 1 ? Visibility.Visible : Visibility.Collapsed;
            UpdateVersionDisplay();
        }

        private void UpdateVersionDisplay()
        {
            _versionText.Text = $"v{_currentVersion} / {_totalVersions}";
            _prevVersion.IsEnabled = _currentVersion > 1;
            _nextVersion.IsEnabled = _currentVersion < _totalVersions;
        }

        public void Send(WidgetEvent evt)
        {
            _state = Reduce(_state, evt);
            UpdateVisuals();
        }

        private void UpdateVisuals()
        {
            _contentScroll.Visibility = _state != WidgetState.Collapsed && _state != WidgetState.Loading ? Visibility.Visible : Visibility.Collapsed;
            _loadingRing.IsActive = _state == WidgetState.Loading;
            _loadingRing.Visibility = _state == WidgetState.Loading ? Visibility.Visible : Visibility.Collapsed;
            _toggleButton.Content = _state == WidgetState.Collapsed ? "\u25B6" : "\u25BC";
            _fullscreenButton.Content = _state == WidgetState.Fullscreen ? "\u2923" : "\u2922";
        }

        private WidgetState Reduce(WidgetState state, WidgetEvent evt) => state switch
        {
            WidgetState.Open when evt == WidgetEvent.Toggle => WidgetState.Collapsed,
            WidgetState.Open when evt == WidgetEvent.Fullscreen => WidgetState.Fullscreen,
            WidgetState.Open when evt == WidgetEvent.Load => WidgetState.Loading,
            WidgetState.Collapsed when evt == WidgetEvent.Toggle => WidgetState.Open,
            WidgetState.Fullscreen when evt == WidgetEvent.ExitFullscreen => WidgetState.Open,
            WidgetState.Fullscreen when evt == WidgetEvent.Toggle => WidgetState.Collapsed,
            WidgetState.Loading when evt == WidgetEvent.LoadComplete => WidgetState.Open,
            _ => state
        };
    }
}
