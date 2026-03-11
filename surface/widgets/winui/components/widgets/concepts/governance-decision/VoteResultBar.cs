using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Dispatching;

namespace Clef.Surface.Widgets.Concepts.GovernanceDecision
{
    /// <summary>
    /// Proportional bar chart showing vote result segments with quorum marker
    /// </summary>
    public sealed partial class VoteResultBar : UserControl, IDisposable
    {
        private enum WidgetState
        {
        Idle,
        Animating,
        SegmentHovered
        }

        private enum WidgetEvent
        {
        HOVER_SEGMENT,
        ANIMATE_IN,
        ANIMATION_END,
        UNHOVER,
        FOCUS_NEXT_SEGMENT,
        FOCUS_PREV_SEGMENT
        }

        private WidgetState _state = WidgetState.Idle;
        private DispatcherTimer? _timer;
        private int _hoveredSegmentIndex = -1;
        private int _focusedSegmentIndex = 0;
        private readonly StackPanel _barContainer = new() { Orientation = Orientation.Horizontal };
        private readonly TextBlock _tooltipText = new() { Visibility = Visibility.Collapsed };
        private readonly TextBlock _quorumLabel = new();

        // --- UI elements ---
        private readonly StackPanel _root;

        public VoteResultBar()
        {
            _root = new StackPanel { Spacing = 4 };
            BuildUI();
            this.Content = _root;

            AutomationProperties.SetName(this, "Proportional bar chart showing vote result segments with quorum marker");
            this.PointerEntered += OnPointerEntered;
            this.PointerExited += OnPointerExited;

            this.KeyDown += OnKeyDown;
        }

        private void BuildUI()
        {
            _root.Children.Clear();
            _root.Children.Add(_barContainer);
            AutomationProperties.SetName(_barContainer, "Vote result bar");
            _root.Children.Add(_tooltipText);
            _root.Children.Add(_quorumLabel);
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
                WidgetEvent.ANIMATE_IN => WidgetState.Animating,
                _ => state
            },
            WidgetState.Animating => @event switch
            {
                WidgetEvent.ANIMATION_END => WidgetState.Idle,
                _ => state
            },
            WidgetState.SegmentHovered => @event switch
            {
                WidgetEvent.UNHOVER => WidgetState.Idle,
                WidgetEvent.HOVER_SEGMENT => WidgetState.SegmentHovered,
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
            if (_timer != null) { _timer.Stop(); _timer = null; }
            this.PointerEntered -= OnPointerEntered;
            this.PointerExited -= OnPointerExited;
            this.KeyDown -= OnKeyDown;
        }
    }
}
