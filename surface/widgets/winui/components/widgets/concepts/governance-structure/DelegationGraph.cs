using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts.GovernanceStructure
{
    /// <summary>
    /// Graph visualization of voting power delegation chains with search
    /// </summary>
    public sealed partial class DelegationGraph : UserControl, IDisposable
    {
        private enum WidgetState
        {
        Browsing,
        Searching,
        Selected,
        Delegating,
        Undelegating
        }

        private enum WidgetEvent
        {
        SEARCH,
        SELECT_DELEGATE,
        SWITCH_VIEW,
        CLEAR_SEARCH,
        DESELECT,
        DELEGATE,
        UNDELEGATE,
        DELEGATE_COMPLETE,
        DELEGATE_ERROR,
        UNDELEGATE_COMPLETE,
        UNDELEGATE_ERROR
        }

        private WidgetState _state = WidgetState.Browsing;
        private string? _selectedDelegateId;
        private string _searchQuery = "";
        private readonly TextBox _searchBox = new() { PlaceholderText = "Search delegates..." };
        private readonly ScrollViewer _graphArea = new();
        private readonly StackPanel _detailPanel = new();
        private readonly Button _delegateBtn = new() { Content = "Delegate" };
        private readonly Button _undelegateBtn = new() { Content = "Undelegate" };
        private readonly ProgressRing _loadingRing = new() { IsActive = false };

        // --- UI elements ---
        private readonly StackPanel _root;

        public DelegationGraph()
        {
            _root = new StackPanel { Spacing = 4 };
            BuildUI();
            this.Content = _root;

            AutomationProperties.SetName(this, "Graph visualization of voting power delegation chains with search");

            this.KeyDown += OnKeyDown;
        }

        private void BuildUI()
        {
            _root.Children.Clear();
            _searchBox.TextChanged += (s, e) => { _searchQuery = _searchBox.Text; Send(_searchQuery.Length > 0 ? WidgetEvent.SEARCH : WidgetEvent.CLEAR_SEARCH); };
            _root.Children.Add(_searchBox);

            _root.Children.Add(_graphArea);
            AutomationProperties.SetName(_graphArea, "Delegation graph");

            _detailPanel.Visibility = Visibility.Collapsed;
            _delegateBtn.Click += (s, e) => Send(WidgetEvent.DELEGATE);
            _undelegateBtn.Click += (s, e) => Send(WidgetEvent.UNDELEGATE);
            var actionBar = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            actionBar.Children.Add(_delegateBtn);
            actionBar.Children.Add(_undelegateBtn);
            actionBar.Children.Add(_loadingRing);
            _detailPanel.Children.Add(actionBar);
            _root.Children.Add(_detailPanel);
        }

        public void Send(WidgetEvent @event)
        {
            _state = Reduce(_state, @event);
            UpdateVisualState();
        }

        private static WidgetState Reduce(WidgetState state, WidgetEvent @event) => state switch
        {
            WidgetState.Browsing => @event switch
            {
                WidgetEvent.SEARCH => WidgetState.Searching,
                WidgetEvent.SELECT_DELEGATE => WidgetState.Selected,
                WidgetEvent.SWITCH_VIEW => WidgetState.Browsing,
                _ => state
            },
            WidgetState.Searching => @event switch
            {
                WidgetEvent.CLEAR_SEARCH => WidgetState.Browsing,
                WidgetEvent.SELECT_DELEGATE => WidgetState.Selected,
                _ => state
            },
            WidgetState.Selected => @event switch
            {
                WidgetEvent.DESELECT => WidgetState.Browsing,
                WidgetEvent.DELEGATE => WidgetState.Delegating,
                WidgetEvent.UNDELEGATE => WidgetState.Undelegating,
                _ => state
            },
            WidgetState.Delegating => @event switch
            {
                WidgetEvent.DELEGATE_COMPLETE => WidgetState.Browsing,
                WidgetEvent.DELEGATE_ERROR => WidgetState.Selected,
                _ => state
            },
            WidgetState.Undelegating => @event switch
            {
                WidgetEvent.UNDELEGATE_COMPLETE => WidgetState.Browsing,
                WidgetEvent.UNDELEGATE_ERROR => WidgetState.Selected,
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
