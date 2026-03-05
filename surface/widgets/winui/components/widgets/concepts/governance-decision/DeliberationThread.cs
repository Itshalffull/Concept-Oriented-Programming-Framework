using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts.GovernanceDecision
{
    /// <summary>
    /// Threaded discussion view for governance deliberations with nested replies
    /// </summary>
    public sealed partial class DeliberationThread : UserControl, IDisposable
    {
        private enum WidgetState
        {
        Viewing,
        Composing,
        EntrySelected
        }

        private enum WidgetEvent
        {
        REPLY_TO,
        SELECT_ENTRY,
        SEND,
        CANCEL,
        DESELECT
        }

        private WidgetState _state = WidgetState.Viewing;
        private string? _replyTargetId;
        private string? _selectedEntryId;
        private string _sortOrder = "chronological";
        private readonly ScrollViewer _threadScroll = new();
        private readonly StackPanel _threadPanel = new();
        private readonly StackPanel _composeBox = new();
        private readonly TextBox _composeInput = new() { PlaceholderText = "Write a reply...", AcceptsReturn = true };
        private readonly Button _sendBtn = new() { Content = "Send" };
        private readonly Button _cancelBtn = new() { Content = "Cancel" };
        private readonly StackPanel _sortBar = new() { Orientation = Orientation.Horizontal, Spacing = 4 };

        // --- UI elements ---
        private readonly StackPanel _root;

        public DeliberationThread()
        {
            _root = new StackPanel { Spacing = 4 };
            BuildUI();
            this.Content = _root;

            AutomationProperties.SetName(this, "Threaded discussion view for governance deliberations with nested replies");

            this.KeyDown += OnKeyDown;
        }

        private void BuildUI()
        {
            _root.Children.Clear();
            // Sort controls
            foreach (var sort in new[] { "chronological", "sentiment", "newest" })
            {
                var s = sort;
                var btn = new Button { Content = char.ToUpper(s[0]) + s.Substring(1), Tag = s };
                btn.Click += (sender, e) => { _sortOrder = ((Button)sender!).Tag as string ?? "chronological"; };
                _sortBar.Children.Add(btn);
            }
            _root.Children.Add(_sortBar);

            // Thread area
            _threadScroll.Content = _threadPanel;
            _root.Children.Add(_threadScroll);
            AutomationProperties.SetName(_threadScroll, "Deliberation thread");

            // Compose box
            _composeBox.Visibility = Visibility.Collapsed;
            _sendBtn.Click += (s, e) => Send(WidgetEvent.SEND);
            _cancelBtn.Click += (s, e) => Send(WidgetEvent.CANCEL);
            _composeBox.Children.Add(_composeInput);
            var btnRow = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            btnRow.Children.Add(_sendBtn);
            btnRow.Children.Add(_cancelBtn);
            _composeBox.Children.Add(btnRow);
            _root.Children.Add(_composeBox);
        }

        public void Send(WidgetEvent @event)
        {
            _state = Reduce(_state, @event);
            UpdateVisualState();
        }

        private static WidgetState Reduce(WidgetState state, WidgetEvent @event) => state switch
        {
            WidgetState.Viewing => @event switch
            {
                WidgetEvent.REPLY_TO => WidgetState.Composing,
                WidgetEvent.SELECT_ENTRY => WidgetState.EntrySelected,
                _ => state
            },
            WidgetState.Composing => @event switch
            {
                WidgetEvent.SEND => WidgetState.Viewing,
                WidgetEvent.CANCEL => WidgetState.Viewing,
                _ => state
            },
            WidgetState.EntrySelected => @event switch
            {
                WidgetEvent.DESELECT => WidgetState.Viewing,
                WidgetEvent.REPLY_TO => WidgetState.Composing,
                _ => state
            },
            _ => state
        };

        private void UpdateVisualState()
        {
            // Update visual properties based on current _state
        }

        private void OnKeyDown(object sender, Microsoft.UI.Xaml.Input.KeyRoutedEventArgs e)
        {
            if (e.Key == Windows.System.VirtualKey.Escape)
            {
                // Context-specific escape handling
            }
        }

        public void Dispose()
        {
            this.KeyDown -= OnKeyDown;
        }
    }
}
