using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using System;

namespace Clef.Surface.Widgets.Concepts.LlmConversation
{
    public sealed partial class MessageBranchNav : UserControl
    {
        private enum WidgetState { Viewing, Navigating }
        private enum WidgetEvent { Navigate, Settle }

        private WidgetState _state = WidgetState.Viewing;
        private readonly StackPanel _root;
        private readonly Button _prevButton;
        private readonly TextBlock _positionText;
        private readonly Button _nextButton;
        private int _currentIndex = 0;
        private int _totalBranches = 1;

        public event Action<int> OnBranchChange;

        public MessageBranchNav()
        {
            _root = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };

            _prevButton = new Button { Content = "\u2190", FontSize = 12, Padding = new Thickness(6, 2, 6, 2) };
            _prevButton.Click += (s, e) =>
            {
                if (_currentIndex > 0)
                {
                    _currentIndex--;
                    UpdateDisplay();
                    Send(WidgetEvent.Navigate);
                    OnBranchChange?.Invoke(_currentIndex);
                }
            };
            AutomationProperties.SetName(_prevButton, "Previous branch");

            _positionText = new TextBlock
            {
                Text = "1 / 1",
                FontSize = 12,
                VerticalAlignment = VerticalAlignment.Center,
                Opacity = 0.8
            };

            _nextButton = new Button { Content = "\u2192", FontSize = 12, Padding = new Thickness(6, 2, 6, 2) };
            _nextButton.Click += (s, e) =>
            {
                if (_currentIndex < _totalBranches - 1)
                {
                    _currentIndex++;
                    UpdateDisplay();
                    Send(WidgetEvent.Navigate);
                    OnBranchChange?.Invoke(_currentIndex);
                }
            };
            AutomationProperties.SetName(_nextButton, "Next branch");

            _root.Children.Add(_prevButton);
            _root.Children.Add(_positionText);
            _root.Children.Add(_nextButton);

            this.Content = _root;
            AutomationProperties.SetName(this, "Navigation control for conversation branching and regeneration");
        }

        public void SetBranches(int current, int total)
        {
            _currentIndex = current;
            _totalBranches = total;
            UpdateDisplay();
        }

        private void UpdateDisplay()
        {
            _positionText.Text = $"{_currentIndex + 1} / {_totalBranches}";
            _prevButton.IsEnabled = _currentIndex > 0;
            _nextButton.IsEnabled = _currentIndex < _totalBranches - 1;
        }

        public void Send(WidgetEvent evt)
        {
            _state = Reduce(_state, evt);
        }

        private WidgetState Reduce(WidgetState state, WidgetEvent evt) => state switch
        {
            WidgetState.Viewing when evt == WidgetEvent.Navigate => WidgetState.Navigating,
            WidgetState.Navigating when evt == WidgetEvent.Settle => WidgetState.Viewing,
            WidgetState.Navigating when evt == WidgetEvent.Navigate => WidgetState.Navigating,
            _ => state
        };
    }
}
