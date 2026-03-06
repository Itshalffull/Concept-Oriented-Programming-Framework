using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System;

namespace Clef.Surface.Widgets.Concepts.LlmAgent
{
    public sealed partial class ReasoningBlock : UserControl
    {
        private enum WidgetState { Collapsed, Expanded, Streaming }
        private enum WidgetEvent { Toggle, StreamStart, StreamEnd, StreamToken }

        private WidgetState _state = WidgetState.Collapsed;
        private readonly StackPanel _root;
        private readonly StackPanel _header;
        private readonly Button _toggleButton;
        private readonly TextBlock _label;
        private readonly TextBlock _tokenCount;
        private readonly TextBlock _durationText;
        private readonly ProgressRing _streamingIndicator;
        private readonly Border _contentBorder;
        private readonly TextBlock _contentText;
        private int _tokens = 0;

        public ReasoningBlock()
        {
            _root = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4 };

            // Header row
            _header = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            _toggleButton = new Button { Content = "\u25B6", FontSize = 12, Padding = new Thickness(4) };
            _toggleButton.Click += (s, e) => Send(WidgetEvent.Toggle);
            AutomationProperties.SetName(_toggleButton, "Toggle reasoning block");

            _label = new TextBlock { Text = "Reasoning", FontSize = 13, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold, VerticalAlignment = VerticalAlignment.Center };
            _tokenCount = new TextBlock { Text = "", FontSize = 11, Opacity = 0.6, VerticalAlignment = VerticalAlignment.Center };
            _durationText = new TextBlock { Text = "", FontSize = 11, Opacity = 0.6, VerticalAlignment = VerticalAlignment.Center };
            _streamingIndicator = new ProgressRing { IsActive = false, Width = 14, Height = 14, Visibility = Visibility.Collapsed };

            _header.Children.Add(_toggleButton);
            _header.Children.Add(_label);
            _header.Children.Add(_streamingIndicator);
            _header.Children.Add(_tokenCount);
            _header.Children.Add(_durationText);
            _root.Children.Add(_header);

            // Content area
            _contentBorder = new Border
            {
                Padding = new Thickness(12, 8, 12, 8),
                Visibility = Visibility.Collapsed,
                BorderThickness = new Thickness(2, 0, 0, 0),
                BorderBrush = new SolidColorBrush(Colors.Gray)
            };
            _contentText = new TextBlock { Text = "", TextWrapping = TextWrapping.Wrap, FontSize = 13, IsTextSelectionEnabled = true };
            _contentBorder.Child = _contentText;
            _root.Children.Add(_contentBorder);

            this.Content = _root;
            AutomationProperties.SetName(this, "Collapsible display for LLM chain-of-thought reasoning");
        }

        public void SetContent(string text)
        {
            _contentText.Text = text;
            _tokens = text.Length / 4; // rough estimate
            _tokenCount.Text = $"{_tokens} tokens";
        }

        public void SetDuration(string duration) => _durationText.Text = duration;

        public void AppendToken(string token)
        {
            _contentText.Text += token;
            _tokens++;
            _tokenCount.Text = $"{_tokens} tokens";
            Send(WidgetEvent.StreamToken);
        }

        public void StartStreaming()
        {
            Send(WidgetEvent.StreamStart);
        }

        public void EndStreaming()
        {
            Send(WidgetEvent.StreamEnd);
        }

        public void Send(WidgetEvent evt)
        {
            _state = Reduce(_state, evt);
            UpdateVisuals();
        }

        private void UpdateVisuals()
        {
            bool showContent = _state == WidgetState.Expanded || _state == WidgetState.Streaming;
            _contentBorder.Visibility = showContent ? Visibility.Visible : Visibility.Collapsed;
            _toggleButton.Content = showContent ? "\u25BC" : "\u25B6";
            _streamingIndicator.IsActive = _state == WidgetState.Streaming;
            _streamingIndicator.Visibility = _state == WidgetState.Streaming ? Visibility.Visible : Visibility.Collapsed;
        }

        private WidgetState Reduce(WidgetState state, WidgetEvent evt) => state switch
        {
            WidgetState.Collapsed when evt == WidgetEvent.Toggle => WidgetState.Expanded,
            WidgetState.Collapsed when evt == WidgetEvent.StreamStart => WidgetState.Streaming,
            WidgetState.Expanded when evt == WidgetEvent.Toggle => WidgetState.Collapsed,
            WidgetState.Streaming when evt == WidgetEvent.StreamEnd => WidgetState.Expanded,
            WidgetState.Streaming when evt == WidgetEvent.StreamToken => WidgetState.Streaming,
            _ => state
        };
    }
}
