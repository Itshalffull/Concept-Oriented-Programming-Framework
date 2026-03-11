using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System;

namespace Clef.Surface.Widgets.Concepts.LlmConversation
{
    public sealed partial class StreamText : UserControl
    {
        private enum WidgetState { Idle, Streaming, Complete, Error }
        private enum WidgetEvent { StreamStart, Token, StreamEnd, Fail, Reset }

        private WidgetState _state = WidgetState.Idle;
        private readonly StackPanel _root;
        private readonly TextBlock _contentText;
        private readonly StackPanel _statusBar;
        private readonly ProgressRing _streamingRing;
        private readonly TextBlock _statusText;
        private readonly TextBlock _tokenCountText;
        private readonly TextBlock _errorText;
        private readonly Border _cursor;
        private int _tokenCount = 0;

        public StreamText()
        {
            _root = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4 };

            // Content
            _contentText = new TextBlock
            {
                Text = "",
                FontSize = 13,
                TextWrapping = TextWrapping.Wrap,
                IsTextSelectionEnabled = true
            };
            AutomationProperties.SetLiveSetting(_contentText, AutomationLiveSetting.Polite);
            _root.Children.Add(_contentText);

            // Cursor (blinking indicator during streaming)
            _cursor = new Border
            {
                Width = 2,
                Height = 14,
                Background = new SolidColorBrush(Colors.Gray),
                Visibility = Visibility.Collapsed,
                HorizontalAlignment = HorizontalAlignment.Left
            };
            _root.Children.Add(_cursor);

            // Status bar
            _statusBar = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            _streamingRing = new ProgressRing { IsActive = false, Width = 12, Height = 12, Visibility = Visibility.Collapsed };
            _statusText = new TextBlock { Text = "", FontSize = 11, Opacity = 0.6, VerticalAlignment = VerticalAlignment.Center };
            _tokenCountText = new TextBlock { Text = "", FontSize = 11, Opacity = 0.5, VerticalAlignment = VerticalAlignment.Center };
            _statusBar.Children.Add(_streamingRing);
            _statusBar.Children.Add(_statusText);
            _statusBar.Children.Add(_tokenCountText);
            _root.Children.Add(_statusBar);

            // Error text
            _errorText = new TextBlock
            {
                Text = "",
                FontSize = 12,
                Foreground = new SolidColorBrush(Colors.Red),
                TextWrapping = TextWrapping.Wrap,
                Visibility = Visibility.Collapsed
            };
            _root.Children.Add(_errorText);

            this.Content = _root;
            AutomationProperties.SetName(this, "Token-by-token text renderer for streaming LLM responses");
        }

        public void StartStream()
        {
            _contentText.Text = "";
            _tokenCount = 0;
            Send(WidgetEvent.StreamStart);
        }

        public void AppendToken(string token)
        {
            _contentText.Text += token;
            _tokenCount++;
            _tokenCountText.Text = $"{_tokenCount} tokens";
            Send(WidgetEvent.Token);
        }

        public void EndStream()
        {
            Send(WidgetEvent.StreamEnd);
        }

        public void SetError(string error)
        {
            _errorText.Text = error;
            Send(WidgetEvent.Fail);
        }

        public void Reset()
        {
            _contentText.Text = "";
            _tokenCount = 0;
            _errorText.Text = "";
            Send(WidgetEvent.Reset);
        }

        public void Send(WidgetEvent evt)
        {
            _state = Reduce(_state, evt);
            UpdateVisuals();
        }

        private void UpdateVisuals()
        {
            _streamingRing.IsActive = _state == WidgetState.Streaming;
            _streamingRing.Visibility = _state == WidgetState.Streaming ? Visibility.Visible : Visibility.Collapsed;
            _cursor.Visibility = _state == WidgetState.Streaming ? Visibility.Visible : Visibility.Collapsed;
            _errorText.Visibility = _state == WidgetState.Error ? Visibility.Visible : Visibility.Collapsed;
            _statusText.Text = _state switch
            {
                WidgetState.Idle => "",
                WidgetState.Streaming => "Streaming...",
                WidgetState.Complete => "Complete",
                WidgetState.Error => "Error",
                _ => ""
            };
        }

        private WidgetState Reduce(WidgetState state, WidgetEvent evt) => state switch
        {
            WidgetState.Idle when evt == WidgetEvent.StreamStart => WidgetState.Streaming,
            WidgetState.Streaming when evt == WidgetEvent.Token => WidgetState.Streaming,
            WidgetState.Streaming when evt == WidgetEvent.StreamEnd => WidgetState.Complete,
            WidgetState.Streaming when evt == WidgetEvent.Fail => WidgetState.Error,
            WidgetState.Complete when evt == WidgetEvent.Reset => WidgetState.Idle,
            WidgetState.Complete when evt == WidgetEvent.StreamStart => WidgetState.Streaming,
            WidgetState.Error when evt == WidgetEvent.Reset => WidgetState.Idle,
            WidgetState.Error when evt == WidgetEvent.StreamStart => WidgetState.Streaming,
            _ => state
        };
    }
}
