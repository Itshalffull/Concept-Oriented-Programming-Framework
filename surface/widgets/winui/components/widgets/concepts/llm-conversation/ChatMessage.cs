using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System;

namespace Clef.Surface.Widgets.Concepts.LlmConversation
{
    public sealed partial class ChatMessage : UserControl
    {
        private enum WidgetState { Idle, Hovered, ActionMenuOpen, Editing, Streaming }
        private enum WidgetEvent { Hover, Leave, OpenActions, CloseActions, Edit, SaveEdit, CancelEdit, StreamStart, StreamEnd }

        private WidgetState _state = WidgetState.Idle;
        private readonly StackPanel _root;
        private readonly StackPanel _header;
        private readonly TextBlock _roleBadge;
        private readonly TextBlock _timestamp;
        private readonly TextBlock _modelBadge;
        private readonly Border _contentBorder;
        private readonly TextBlock _contentText;
        private readonly TextBox _editInput;
        private readonly StackPanel _editButtons;
        private readonly StackPanel _actionBar;
        private readonly Button _copyButton;
        private readonly Button _editButton;
        private readonly Button _deleteButton;
        private readonly Button _retryButton;
        private readonly ProgressRing _streamingRing;
        private readonly StackPanel _feedbackBar;
        private readonly Button _thumbsUp;
        private readonly Button _thumbsDown;

        public event Action OnCopy;
        public event Action<string> OnEdit;
        public event Action OnDelete;
        public event Action OnRetry;
        public event Action<bool> OnFeedback;

        public ChatMessage()
        {
            _root = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4, Padding = new Thickness(8) };

            // Header
            _header = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            _roleBadge = new TextBlock { Text = "User", FontSize = 12, FontWeight = Microsoft.UI.Text.FontWeights.Bold, VerticalAlignment = VerticalAlignment.Center };
            _timestamp = new TextBlock { Text = "", FontSize = 11, Opacity = 0.6, VerticalAlignment = VerticalAlignment.Center };
            _modelBadge = new TextBlock { Text = "", FontSize = 11, Opacity = 0.5, VerticalAlignment = VerticalAlignment.Center };
            _streamingRing = new ProgressRing { IsActive = false, Width = 12, Height = 12, Visibility = Visibility.Collapsed };
            _header.Children.Add(_roleBadge);
            _header.Children.Add(_modelBadge);
            _header.Children.Add(_streamingRing);
            _header.Children.Add(_timestamp);
            _root.Children.Add(_header);

            // Content
            _contentBorder = new Border { Padding = new Thickness(8), CornerRadius = new CornerRadius(4) };
            _contentText = new TextBlock { Text = "", FontSize = 13, TextWrapping = TextWrapping.Wrap, IsTextSelectionEnabled = true };
            _contentBorder.Child = _contentText;
            _root.Children.Add(_contentBorder);

            // Edit input (hidden)
            _editInput = new TextBox { AcceptsReturn = true, Visibility = Visibility.Collapsed, TextWrapping = TextWrapping.Wrap };
            AutomationProperties.SetName(_editInput, "Edit message content");
            _root.Children.Add(_editInput);

            _editButtons = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4, Visibility = Visibility.Collapsed };
            var saveBtn = new Button { Content = "Save" };
            saveBtn.Click += (s, e) =>
            {
                Send(WidgetEvent.SaveEdit);
                OnEdit?.Invoke(_editInput.Text);
            };
            var cancelBtn = new Button { Content = "Cancel" };
            cancelBtn.Click += (s, e) => Send(WidgetEvent.CancelEdit);
            _editButtons.Children.Add(saveBtn);
            _editButtons.Children.Add(cancelBtn);
            _root.Children.Add(_editButtons);

            // Action bar (shown on hover)
            _actionBar = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4, Visibility = Visibility.Collapsed };
            _copyButton = new Button { Content = "\u2398", FontSize = 11 };
            _copyButton.Click += (s, e) => OnCopy?.Invoke();
            AutomationProperties.SetName(_copyButton, "Copy message");

            _editButton = new Button { Content = "\u270E", FontSize = 11 };
            _editButton.Click += (s, e) =>
            {
                _editInput.Text = _contentText.Text;
                Send(WidgetEvent.Edit);
            };
            AutomationProperties.SetName(_editButton, "Edit message");

            _retryButton = new Button { Content = "\u21BB", FontSize = 11 };
            _retryButton.Click += (s, e) => OnRetry?.Invoke();
            AutomationProperties.SetName(_retryButton, "Retry message");

            _deleteButton = new Button { Content = "\u2717", FontSize = 11 };
            _deleteButton.Click += (s, e) => OnDelete?.Invoke();
            AutomationProperties.SetName(_deleteButton, "Delete message");

            _actionBar.Children.Add(_copyButton);
            _actionBar.Children.Add(_editButton);
            _actionBar.Children.Add(_retryButton);
            _actionBar.Children.Add(_deleteButton);
            _root.Children.Add(_actionBar);

            // Feedback bar
            _feedbackBar = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4, Visibility = Visibility.Collapsed };
            _thumbsUp = new Button { Content = "\u2191", FontSize = 11 };
            _thumbsUp.Click += (s, e) => OnFeedback?.Invoke(true);
            AutomationProperties.SetName(_thumbsUp, "Thumbs up");
            _thumbsDown = new Button { Content = "\u2193", FontSize = 11 };
            _thumbsDown.Click += (s, e) => OnFeedback?.Invoke(false);
            AutomationProperties.SetName(_thumbsDown, "Thumbs down");
            _feedbackBar.Children.Add(_thumbsUp);
            _feedbackBar.Children.Add(_thumbsDown);
            _root.Children.Add(_feedbackBar);

            // Hover events
            _root.PointerEntered += (s, e) => Send(WidgetEvent.Hover);
            _root.PointerExited += (s, e) => Send(WidgetEvent.Leave);

            this.Content = _root;
            AutomationProperties.SetName(this, "Role-differentiated message container for chat conversations");
        }

        public void SetMessage(string role, string content, string timestamp = null, string model = null)
        {
            _roleBadge.Text = role;
            _contentText.Text = content;
            _timestamp.Text = timestamp ?? "";
            _modelBadge.Text = model ?? "";
            _feedbackBar.Visibility = role == "assistant" ? Visibility.Collapsed : Visibility.Collapsed;
            // Show feedback only for assistant on hover
        }

        public void AppendToken(string token)
        {
            _contentText.Text += token;
        }

        public void SetStreaming(bool streaming)
        {
            Send(streaming ? WidgetEvent.StreamStart : WidgetEvent.StreamEnd);
        }

        public void Send(WidgetEvent evt)
        {
            _state = Reduce(_state, evt);
            UpdateVisuals();
        }

        private void UpdateVisuals()
        {
            _actionBar.Visibility = _state == WidgetState.Hovered ? Visibility.Visible : Visibility.Collapsed;
            _editInput.Visibility = _state == WidgetState.Editing ? Visibility.Visible : Visibility.Collapsed;
            _editButtons.Visibility = _state == WidgetState.Editing ? Visibility.Visible : Visibility.Collapsed;
            _contentBorder.Visibility = _state != WidgetState.Editing ? Visibility.Visible : Visibility.Collapsed;
            _streamingRing.IsActive = _state == WidgetState.Streaming;
            _streamingRing.Visibility = _state == WidgetState.Streaming ? Visibility.Visible : Visibility.Collapsed;
        }

        private WidgetState Reduce(WidgetState state, WidgetEvent evt) => state switch
        {
            WidgetState.Idle when evt == WidgetEvent.Hover => WidgetState.Hovered,
            WidgetState.Idle when evt == WidgetEvent.StreamStart => WidgetState.Streaming,
            WidgetState.Hovered when evt == WidgetEvent.Leave => WidgetState.Idle,
            WidgetState.Hovered when evt == WidgetEvent.Edit => WidgetState.Editing,
            WidgetState.Editing when evt == WidgetEvent.SaveEdit => WidgetState.Idle,
            WidgetState.Editing when evt == WidgetEvent.CancelEdit => WidgetState.Idle,
            WidgetState.Streaming when evt == WidgetEvent.StreamEnd => WidgetState.Idle,
            _ => state
        };
    }
}
