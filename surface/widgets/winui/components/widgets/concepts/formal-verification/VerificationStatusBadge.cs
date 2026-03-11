using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Dispatching;

namespace Clef.Surface.Widgets.Concepts.FormalVerification
{
    /// <summary>
    /// Compact status badge showing verification result with icon and tooltip
    /// </summary>
    public sealed partial class VerificationStatusBadge : UserControl, IDisposable
    {
        private enum WidgetState
        {
        Idle,
        Hovered,
        Animating
        }

        private enum WidgetEvent
        {
        HOVER,
        STATUS_CHANGE,
        LEAVE,
        ANIMATION_END
        }

        private WidgetState _state = WidgetState.Idle;
        private DispatcherTimer? _timer;
        private string _status = "unknown";
        private readonly TextBlock _iconText = new() { FontSize = 16 };
        private readonly TextBlock _labelText = new();
        private readonly Border _badge = new() { Padding = new Thickness(6, 2, 6, 2), CornerRadius = new CornerRadius(4) };

        // --- UI elements ---
        private readonly StackPanel _root;

        public VerificationStatusBadge()
        {
            _root = new StackPanel { Spacing = 4 };
            BuildUI();
            this.Content = _root;

            AutomationProperties.SetName(this, "Compact status badge showing verification result with icon and tooltip");
            this.PointerEntered += OnPointerEntered;
            this.PointerExited += OnPointerExited;

            this.KeyDown += OnKeyDown;
        }

        private void BuildUI()
        {
            _root.Children.Clear();
            var inner = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            inner.Children.Add(_iconText);
            inner.Children.Add(_labelText);
            _badge.Child = inner;
            _root.Children.Add(_badge);
            ToolTipService.SetToolTip(_badge, "Verification status");
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
                WidgetEvent.HOVER => WidgetState.Hovered,
                WidgetEvent.STATUS_CHANGE => WidgetState.Animating,
                _ => state
            },
            WidgetState.Hovered => @event switch
            {
                WidgetEvent.LEAVE => WidgetState.Idle,
                _ => state
            },
            WidgetState.Animating => @event switch
            {
                WidgetEvent.ANIMATION_END => WidgetState.Idle,
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
