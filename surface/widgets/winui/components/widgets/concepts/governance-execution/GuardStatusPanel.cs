using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts.GovernanceExecution
{
    /// <summary>
    /// Panel listing guard conditions with pass/fail status indicators
    /// </summary>
    public sealed partial class GuardStatusPanel : UserControl, IDisposable
    {
        private enum WidgetState
        {
        Idle,
        GuardSelected
        }

        private enum WidgetEvent
        {
        SELECT_GUARD,
        GUARD_TRIP,
        DESELECT
        }

        private WidgetState _state = WidgetState.Idle;
        private string? _selectedGuardId;
        private readonly StackPanel _guardList = new();
        private readonly InfoBar _blockingBanner = new() { IsOpen = false, Severity = InfoBarSeverity.Warning, Title = "Guards blocking execution" };
        private readonly StackPanel _detailPanel = new();

        // --- UI elements ---
        private readonly StackPanel _root;

        public GuardStatusPanel()
        {
            _root = new StackPanel { Spacing = 4 };
            BuildUI();
            this.Content = _root;

            AutomationProperties.SetName(this, "Panel listing guard conditions with pass/fail status indicators");

            this.KeyDown += OnKeyDown;
        }

        private void BuildUI()
        {
            _root.Children.Clear();
            _root.Children.Add(_blockingBanner);
            _root.Children.Add(_guardList);
            AutomationProperties.SetName(_guardList, "Guard conditions");
            _detailPanel.Visibility = Visibility.Collapsed;
            _root.Children.Add(_detailPanel);
        }

        public void Send(WidgetEvent @event)
        {
            _state = Reduce(_state, @event);
            UpdateVisualState();
        }

        private static WidgetState Reduce(WidgetState state, WidgetEvent @event) => state switch
        {
            WidgetState.Idle => @event switch
            {
                WidgetEvent.SELECT_GUARD => WidgetState.GuardSelected,
                WidgetEvent.GUARD_TRIP => WidgetState.Idle,
                _ => state
            },
            WidgetState.GuardSelected => @event switch
            {
                WidgetEvent.DESELECT => WidgetState.Idle,
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
