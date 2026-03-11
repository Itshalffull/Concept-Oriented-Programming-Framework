using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Input;

namespace Clef.Surface.Widgets.Concepts.GovernanceDecision
{
    /// <summary>
    /// Card displaying a governance proposal with status, description, and actions
    /// </summary>
    public sealed partial class ProposalCard : UserControl, IDisposable
    {
        private enum WidgetState
        {
        Idle,
        Hovered,
        Focused,
        Navigating
        }

        private enum WidgetEvent
        {
        HOVER,
        UNHOVER,
        FOCUS,
        BLUR,
        CLICK,
        ENTER,
        NAVIGATE_COMPLETE
        }

        private WidgetState _state = WidgetState.Idle;
        private readonly Border _card = new() { Padding = new Thickness(12), CornerRadius = new CornerRadius(8) };
        private readonly TextBlock _titleText = new() { FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
        private readonly TextBlock _statusBadge = new();
        private readonly TextBlock _descriptionText = new() { TextWrapping = TextWrapping.Wrap, MaxLines = 3 };
        private readonly TextBlock _timeRemaining = new();
        private readonly Button _actionBtn = new() { Content = "View" };

        // --- UI elements ---
        private readonly StackPanel _root;

        public ProposalCard()
        {
            _root = new StackPanel { Spacing = 4 };
            BuildUI();
            this.Content = _root;

            AutomationProperties.SetName(this, "Card displaying a governance proposal with status, description, and actions");
            this.PointerEntered += OnPointerEntered;
            this.PointerExited += OnPointerExited;

            this.KeyDown += OnKeyDown;
        }

        private void BuildUI()
        {
            _root.Children.Clear();
            var inner = new StackPanel { Spacing = 6 };
            var header = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            header.Children.Add(_titleText);
            header.Children.Add(_statusBadge);
            inner.Children.Add(header);
            inner.Children.Add(_descriptionText);
            var footer = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            footer.Children.Add(_timeRemaining);
            _actionBtn.Click += (s, e) => Send(WidgetEvent.CLICK);
            footer.Children.Add(_actionBtn);
            inner.Children.Add(footer);
            _card.Child = inner;
            _root.Children.Add(_card);
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
                WidgetEvent.FOCUS => WidgetState.Focused,
                WidgetEvent.CLICK => WidgetState.Navigating,
                _ => state
            },
            WidgetState.Hovered => @event switch
            {
                WidgetEvent.UNHOVER => WidgetState.Idle,
                _ => state
            },
            WidgetState.Focused => @event switch
            {
                WidgetEvent.BLUR => WidgetState.Idle,
                WidgetEvent.CLICK => WidgetState.Navigating,
                WidgetEvent.ENTER => WidgetState.Navigating,
                _ => state
            },
            WidgetState.Navigating => @event switch
            {
                WidgetEvent.NAVIGATE_COMPLETE => WidgetState.Idle,
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
