using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts.GovernanceStructure
{
    /// <summary>
    /// Organizational chart showing nested circles with members and roles
    /// </summary>
    public sealed partial class CircleOrgChart : UserControl, IDisposable
    {
        private enum WidgetState
        {
        Idle,
        CircleSelected
        }

        private enum WidgetEvent
        {
        SELECT_CIRCLE,
        DESELECT,
        EXPAND,
        COLLAPSE
        }

        private WidgetState _state = WidgetState.Idle;
        private string? _selectedCircleId;
        private readonly TreeView _orgTree = new();
        private readonly StackPanel _detailPanel = new();
        private readonly TextBlock _circleName = new() { FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
        private readonly TextBlock _circlePurpose = new() { TextWrapping = TextWrapping.Wrap };
        private readonly StackPanel _membersList = new();

        // --- UI elements ---
        private readonly StackPanel _root;

        public CircleOrgChart()
        {
            _root = new StackPanel { Spacing = 4 };
            BuildUI();
            this.Content = _root;

            AutomationProperties.SetName(this, "Organizational chart showing nested circles with members and roles");

            this.KeyDown += OnKeyDown;
        }

        private void BuildUI()
        {
            _root.Children.Clear();
            AutomationProperties.SetName(_orgTree, "Circle organization chart");
            _root.Children.Add(_orgTree);

            _detailPanel.Visibility = Visibility.Collapsed;
            _detailPanel.Children.Add(_circleName);
            _detailPanel.Children.Add(_circlePurpose);
            _detailPanel.Children.Add(_membersList);
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
                WidgetEvent.SELECT_CIRCLE => WidgetState.CircleSelected,
                _ => state
            },
            WidgetState.CircleSelected => @event switch
            {
                WidgetEvent.DESELECT => WidgetState.Idle,
                WidgetEvent.SELECT_CIRCLE => WidgetState.CircleSelected,
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
