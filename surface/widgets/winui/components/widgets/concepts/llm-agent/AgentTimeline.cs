using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;

namespace Clef.Surface.Widgets.Concepts.LlmAgent
{
    public sealed partial class AgentTimeline : UserControl
    {
        private enum WidgetState { Idle, EntrySelected, Interrupted, Inactive, Active }
        private enum WidgetEvent { NewEntry, SelectEntry, Interrupt, Deselect, Resume, StreamStart, StreamEnd }

        private WidgetState _state = WidgetState.Idle;
        private int _selectedIndex = -1;
        private string _typeFilter = null;
        private readonly StackPanel _root;
        private readonly StackPanel _headerPanel;
        private readonly TextBlock _agentBadge;
        private readonly TextBlock _statusIndicator;
        private readonly Button _interruptButton;
        private readonly StackPanel _filterBar;
        private readonly TextBlock _interruptBanner;
        private readonly StackPanel _timelinePanel;
        private readonly ScrollViewer _scrollViewer;

        private static readonly string[] AllTypes = { "thought", "tool-call", "tool-result", "response", "error" };
        private static readonly string[] TypeIcons = { "\u2022\u2022\u2022", "\u2699", "\u2611", "\u25B6", "\u2717" };
        private static readonly string[] TypeLabels = { "Thought", "Tool Call", "Tool Result", "Response", "Error" };

        public AgentTimeline()
        {
            _root = new StackPanel { Orientation = Orientation.Vertical, Spacing = 8 };

            // Header
            _headerPanel = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            _agentBadge = new TextBlock { Text = "Agent", FontWeight = Microsoft.UI.Text.FontWeights.Bold, FontSize = 14 };
            _statusIndicator = new TextBlock { Text = "\u25CB idle", FontSize = 13 };
            _interruptButton = new Button { Content = "Interrupt", Visibility = Visibility.Collapsed };
            _interruptButton.Click += (s, e) => Send(WidgetEvent.Interrupt);
            _headerPanel.Children.Add(_agentBadge);
            _headerPanel.Children.Add(_statusIndicator);
            _headerPanel.Children.Add(_interruptButton);
            _root.Children.Add(_headerPanel);

            // Filter bar
            _filterBar = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            var allBtn = new Button { Content = "All" };
            allBtn.Click += (s, e) => { _typeFilter = null; };
            _filterBar.Children.Add(allBtn);
            for (int i = 0; i < AllTypes.Length; i++)
            {
                var idx = i;
                var btn = new Button { Content = $"{TypeIcons[idx]} {TypeLabels[idx]}" };
                btn.Click += (s, e) => { _typeFilter = _typeFilter == AllTypes[idx] ? null : AllTypes[idx]; };
                _filterBar.Children.Add(btn);
            }
            _root.Children.Add(_filterBar);

            // Interrupt banner
            _interruptBanner = new TextBlock
            {
                Text = "Agent execution interrupted",
                Visibility = Visibility.Collapsed,
                Foreground = new SolidColorBrush(Colors.Red),
                FontSize = 13
            };
            AutomationProperties.SetLiveSetting(_interruptBanner, AutomationLiveSetting.Assertive);
            _root.Children.Add(_interruptBanner);

            // Timeline entries
            _timelinePanel = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4 };
            _scrollViewer = new ScrollViewer { Content = _timelinePanel, MaxHeight = 400 };
            _root.Children.Add(_scrollViewer);

            this.Content = _root;
            AutomationProperties.SetName(this, "Multi-agent communication timeline display");
        }

        public void SetAgent(string agentName, string status)
        {
            _agentBadge.Text = agentName;
            _statusIndicator.Text = status == "running" ? "\u25CF running" : $"\u25CB {status}";
            _interruptButton.Visibility = status == "running" ? Visibility.Visible : Visibility.Collapsed;
        }

        public void AddEntry(string type, string label, string timestamp, string duration = null, string status = "complete")
        {
            int typeIdx = System.Array.IndexOf(AllTypes, type);
            string icon = typeIdx >= 0 ? TypeIcons[typeIdx] : "\u2022";

            var entryPanel = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8, Padding = new Thickness(4) };
            var iconText = new TextBlock { Text = icon, FontSize = 13, VerticalAlignment = VerticalAlignment.Center };
            var labelText = new TextBlock { Text = label, FontSize = 13, VerticalAlignment = VerticalAlignment.Center };
            var timeText = new TextBlock { Text = timestamp, FontSize = 11, Opacity = 0.7, VerticalAlignment = VerticalAlignment.Center };

            entryPanel.Children.Add(iconText);
            entryPanel.Children.Add(labelText);

            if (status == "running")
            {
                var runningIndicator = new ProgressRing { IsActive = true, Width = 14, Height = 14 };
                entryPanel.Children.Add(runningIndicator);
            }

            if (duration != null && status != "running")
            {
                entryPanel.Children.Add(new TextBlock { Text = duration, FontSize = 11, Opacity = 0.6 });
            }

            entryPanel.Children.Add(timeText);

            string typeLabel = typeIdx >= 0 ? TypeLabels[typeIdx] : type;
            AutomationProperties.SetName(entryPanel, $"{typeLabel}: {label}");
            _timelinePanel.Children.Add(entryPanel);

            Send(WidgetEvent.NewEntry);
        }

        public void Send(WidgetEvent evt)
        {
            _state = Reduce(_state, evt);
            _interruptBanner.Visibility = _state == WidgetState.Interrupted ? Visibility.Visible : Visibility.Collapsed;
        }

        private WidgetState Reduce(WidgetState state, WidgetEvent evt) => state switch
        {
            WidgetState.Idle when evt == WidgetEvent.NewEntry => WidgetState.Idle,
            WidgetState.Idle when evt == WidgetEvent.SelectEntry => WidgetState.EntrySelected,
            WidgetState.Idle when evt == WidgetEvent.Interrupt => WidgetState.Interrupted,
            WidgetState.EntrySelected when evt == WidgetEvent.Deselect => WidgetState.Idle,
            WidgetState.EntrySelected when evt == WidgetEvent.SelectEntry => WidgetState.EntrySelected,
            WidgetState.Interrupted when evt == WidgetEvent.Resume => WidgetState.Idle,
            WidgetState.Inactive when evt == WidgetEvent.StreamStart => WidgetState.Active,
            WidgetState.Active when evt == WidgetEvent.StreamEnd => WidgetState.Inactive,
            _ => state
        };
    }
}
