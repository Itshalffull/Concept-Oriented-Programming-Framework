using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Input;

namespace Clef.Surface.Widgets.Concepts.GovernanceStructure
{
    /// <summary>
    /// Stacked bar showing voting weight breakdown by source type
    /// </summary>
    public sealed partial class WeightBreakdown : UserControl, IDisposable
    {
        private enum WidgetState
        {
        Idle,
        SegmentHovered
        }

        private enum WidgetEvent
        {
        HOVER_SEGMENT,
        LEAVE
        }

        private WidgetState _state = WidgetState.Idle;
        private int _hoveredIndex = -1;
        private readonly StackPanel _barContainer = new() { Orientation = Orientation.Horizontal };
        private readonly TextBlock _totalLabel = new() { FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
        private readonly TextBlock _tooltipText = new() { Visibility = Visibility.Collapsed };
        private readonly StackPanel _legendPanel = new();

        // --- UI elements ---
        private readonly StackPanel _root;

        public WeightBreakdown()
        {
            _root = new StackPanel { Spacing = 4 };
            BuildUI();
            this.Content = _root;

            AutomationProperties.SetName(this, "Stacked bar showing voting weight breakdown by source type");
            this.PointerEntered += OnPointerEntered;
            this.PointerExited += OnPointerExited;

            this.KeyDown += OnKeyDown;
        }

        private void BuildUI()
        {
            _root.Children.Clear();
            _root.Children.Add(_totalLabel);
            _root.Children.Add(_barContainer);
            AutomationProperties.SetName(_barContainer, "Weight breakdown bar");
            _root.Children.Add(_tooltipText);
            _root.Children.Add(_legendPanel);
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
                WidgetEvent.HOVER_SEGMENT => WidgetState.SegmentHovered,
                _ => state
            },
            WidgetState.SegmentHovered => @event switch
            {
                WidgetEvent.LEAVE => WidgetState.Idle,
                _ => state
            },
            _ => state
        };

        private void UpdateVisualState()
        {
            // Update visual properties based on current _state
        }

        private void OnPointerEntered(object sender, PointerRoutedEventArgs e)
        {
            Send(WidgetEvent.HOVER);
        }

        private void OnPointerExited(object sender, PointerRoutedEventArgs e)
        {
            Send(WidgetEvent.LEAVE);
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
            this.PointerEntered -= OnPointerEntered;
            this.PointerExited -= OnPointerExited;
            this.KeyDown -= OnKeyDown;
        }
    }
}
