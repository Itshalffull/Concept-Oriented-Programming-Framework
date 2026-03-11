using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System;

namespace Clef.Surface.Widgets.Concepts.LlmConversation
{
    public sealed partial class ConversationSidebar : UserControl
    {
        private enum WidgetState { Idle, Searching, Editing, Confirming }
        private enum WidgetEvent { Search, ClearSearch, Select, Edit, SaveEdit, CancelEdit, Delete, ConfirmDelete, CancelDelete, NewConversation }

        private WidgetState _state = WidgetState.Idle;
        private readonly StackPanel _root;
        private readonly StackPanel _header;
        private readonly TextBlock _title;
        private readonly Button _newButton;
        private readonly TextBox _searchInput;
        private readonly Button _clearSearchButton;
        private readonly ScrollViewer _scrollViewer;
        private readonly StackPanel _conversationList;
        private readonly TextBox _editInput;
        private readonly StackPanel _editPanel;
        private readonly StackPanel _confirmPanel;
        private int _selectedIndex = -1;
        private string _editingId = null;

        public event Action OnNewConversation;
        public event Action<int> OnSelect;
        public event Action<string, string> OnRename;
        public event Action<string> OnDelete;

        public ConversationSidebar()
        {
            _root = new StackPanel { Orientation = Orientation.Vertical, Spacing = 8, Padding = new Thickness(8) };

            // Header
            _header = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            _title = new TextBlock { Text = "Conversations", FontSize = 14, FontWeight = Microsoft.UI.Text.FontWeights.Bold, VerticalAlignment = VerticalAlignment.Center };
            _newButton = new Button { Content = "+ New" };
            _newButton.Click += (s, e) =>
            {
                Send(WidgetEvent.NewConversation);
                OnNewConversation?.Invoke();
            };
            AutomationProperties.SetName(_newButton, "New conversation");
            _header.Children.Add(_title);
            _header.Children.Add(_newButton);
            _root.Children.Add(_header);

            // Search
            var searchBar = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            _searchInput = new TextBox { PlaceholderText = "Search conversations...", Width = 180 };
            AutomationProperties.SetName(_searchInput, "Search conversations");
            _searchInput.TextChanged += (s, e) =>
            {
                if (!string.IsNullOrEmpty(_searchInput.Text)) Send(WidgetEvent.Search);
            };
            _clearSearchButton = new Button { Content = "\u2715", Visibility = Visibility.Collapsed };
            _clearSearchButton.Click += (s, e) =>
            {
                _searchInput.Text = "";
                Send(WidgetEvent.ClearSearch);
            };
            AutomationProperties.SetName(_clearSearchButton, "Clear search");
            searchBar.Children.Add(_searchInput);
            searchBar.Children.Add(_clearSearchButton);
            _root.Children.Add(searchBar);

            // Conversation list
            _conversationList = new StackPanel { Orientation = Orientation.Vertical, Spacing = 2 };
            _scrollViewer = new ScrollViewer { Content = _conversationList, MaxHeight = 500 };
            _root.Children.Add(_scrollViewer);

            // Edit panel (hidden)
            _editPanel = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4, Visibility = Visibility.Collapsed };
            _editInput = new TextBox { PlaceholderText = "Rename conversation..." };
            AutomationProperties.SetName(_editInput, "Conversation name");
            var editButtons = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            var saveBtn = new Button { Content = "Save" };
            saveBtn.Click += (s, e) =>
            {
                Send(WidgetEvent.SaveEdit);
                if (_editingId != null) OnRename?.Invoke(_editingId, _editInput.Text);
            };
            var cancelBtn = new Button { Content = "Cancel" };
            cancelBtn.Click += (s, e) => Send(WidgetEvent.CancelEdit);
            editButtons.Children.Add(saveBtn);
            editButtons.Children.Add(cancelBtn);
            _editPanel.Children.Add(_editInput);
            _editPanel.Children.Add(editButtons);
            _root.Children.Add(_editPanel);

            // Confirm delete panel (hidden)
            _confirmPanel = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4, Visibility = Visibility.Collapsed };
            _confirmPanel.Children.Add(new TextBlock { Text = "Delete this conversation?", FontSize = 13 });
            var confirmButtons = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            var deleteBtn = new Button { Content = "Delete" };
            deleteBtn.Click += (s, e) =>
            {
                Send(WidgetEvent.ConfirmDelete);
                if (_editingId != null) OnDelete?.Invoke(_editingId);
            };
            var cancelDeleteBtn = new Button { Content = "Cancel" };
            cancelDeleteBtn.Click += (s, e) => Send(WidgetEvent.CancelDelete);
            confirmButtons.Children.Add(deleteBtn);
            confirmButtons.Children.Add(cancelDeleteBtn);
            _confirmPanel.Children.Add(confirmButtons);
            _root.Children.Add(_confirmPanel);

            this.Content = _root;
            AutomationProperties.SetName(this, "Sidebar panel listing conversation history with search and management");
        }

        public void AddConversation(string id, string title, string preview, string timestamp, bool active = false)
        {
            var item = new StackPanel { Orientation = Orientation.Vertical, Spacing = 2, Padding = new Thickness(8, 6, 8, 6) };
            if (active) item.Background = new SolidColorBrush(Colors.LightGray);

            var headerRow = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            var titleText = new TextBlock { Text = title, FontSize = 13, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
            var timeText = new TextBlock { Text = timestamp, FontSize = 11, Opacity = 0.6 };
            headerRow.Children.Add(titleText);
            headerRow.Children.Add(timeText);

            var previewText = new TextBlock { Text = preview, FontSize = 12, Opacity = 0.7, MaxLines = 1, TextTrimming = TextTrimming.CharacterEllipsis };

            var actions = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4, Visibility = Visibility.Collapsed };
            var editBtn = new Button { Content = "\u270E", FontSize = 10 };
            editBtn.Click += (s, e) =>
            {
                _editingId = id;
                _editInput.Text = title;
                Send(WidgetEvent.Edit);
            };
            AutomationProperties.SetName(editBtn, $"Rename {title}");
            var delBtn = new Button { Content = "\u2717", FontSize = 10 };
            delBtn.Click += (s, e) =>
            {
                _editingId = id;
                Send(WidgetEvent.Delete);
            };
            AutomationProperties.SetName(delBtn, $"Delete {title}");
            actions.Children.Add(editBtn);
            actions.Children.Add(delBtn);

            item.Children.Add(headerRow);
            item.Children.Add(previewText);
            item.Children.Add(actions);

            int index = _conversationList.Children.Count;
            item.PointerEntered += (s, e) => actions.Visibility = Visibility.Visible;
            item.PointerExited += (s, e) => actions.Visibility = Visibility.Collapsed;
            item.PointerPressed += (s, e) =>
            {
                _selectedIndex = index;
                Send(WidgetEvent.Select);
                OnSelect?.Invoke(index);
            };

            AutomationProperties.SetName(item, $"Conversation: {title}");
            _conversationList.Children.Add(item);
        }

        public void Send(WidgetEvent evt)
        {
            _state = Reduce(_state, evt);
            _clearSearchButton.Visibility = _state == WidgetState.Searching ? Visibility.Visible : Visibility.Collapsed;
            _editPanel.Visibility = _state == WidgetState.Editing ? Visibility.Visible : Visibility.Collapsed;
            _confirmPanel.Visibility = _state == WidgetState.Confirming ? Visibility.Visible : Visibility.Collapsed;
        }

        private WidgetState Reduce(WidgetState state, WidgetEvent evt) => state switch
        {
            WidgetState.Idle when evt == WidgetEvent.Search => WidgetState.Searching,
            WidgetState.Idle when evt == WidgetEvent.Edit => WidgetState.Editing,
            WidgetState.Idle when evt == WidgetEvent.Delete => WidgetState.Confirming,
            WidgetState.Searching when evt == WidgetEvent.ClearSearch => WidgetState.Idle,
            WidgetState.Searching when evt == WidgetEvent.Edit => WidgetState.Editing,
            WidgetState.Searching when evt == WidgetEvent.Delete => WidgetState.Confirming,
            WidgetState.Editing when evt == WidgetEvent.SaveEdit => WidgetState.Idle,
            WidgetState.Editing when evt == WidgetEvent.CancelEdit => WidgetState.Idle,
            WidgetState.Confirming when evt == WidgetEvent.ConfirmDelete => WidgetState.Idle,
            WidgetState.Confirming when evt == WidgetEvent.CancelDelete => WidgetState.Idle,
            _ => state
        };
    }
}
