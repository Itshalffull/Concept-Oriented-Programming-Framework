using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System;
using System.Collections.Generic;

namespace Clef.Surface.Widgets.Concepts.LlmAgent
{
    public sealed partial class MemoryInspector : UserControl
    {
        private enum WidgetState { Viewing, Editing, Searching, Confirming }
        private enum WidgetEvent { Search, Edit, Save, Cancel, Delete, ConfirmDelete, CancelDelete, ClearSearch }

        private WidgetState _state = WidgetState.Viewing;
        private readonly StackPanel _root;
        private readonly TextBlock _title;
        private readonly StackPanel _searchBar;
        private readonly TextBox _searchInput;
        private readonly Button _clearSearchButton;
        private readonly StackPanel _statsPanel;
        private readonly TextBlock _totalCount;
        private readonly TextBlock _typeBreakdown;
        private readonly ScrollViewer _scrollViewer;
        private readonly StackPanel _memoryList;
        private readonly StackPanel _editPanel;
        private readonly TextBox _editKeyInput;
        private readonly TextBox _editValueInput;
        private readonly Button _saveButton;
        private readonly Button _cancelButton;
        private readonly StackPanel _confirmPanel;
        private readonly TextBlock _confirmText;
        private readonly Button _confirmDeleteButton;
        private readonly Button _cancelDeleteButton;
        private string _editingKey = null;

        public event Action<string, string> OnSave;
        public event Action<string> OnDelete;

        public MemoryInspector()
        {
            _root = new StackPanel { Orientation = Orientation.Vertical, Spacing = 8, Padding = new Thickness(12) };

            // Header
            _title = new TextBlock { Text = "Memory Inspector", FontSize = 16, FontWeight = Microsoft.UI.Text.FontWeights.Bold };
            _root.Children.Add(_title);

            // Search bar
            _searchBar = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            _searchInput = new TextBox { PlaceholderText = "Search memories...", Width = 200 };
            AutomationProperties.SetName(_searchInput, "Search memories");
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
            _searchBar.Children.Add(_searchInput);
            _searchBar.Children.Add(_clearSearchButton);
            _root.Children.Add(_searchBar);

            // Stats
            _statsPanel = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 12 };
            _totalCount = new TextBlock { Text = "0 entries", FontSize = 12, Opacity = 0.7 };
            _typeBreakdown = new TextBlock { Text = "", FontSize = 12, Opacity = 0.7 };
            _statsPanel.Children.Add(_totalCount);
            _statsPanel.Children.Add(_typeBreakdown);
            _root.Children.Add(_statsPanel);

            // Memory entries list
            _memoryList = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4 };
            _scrollViewer = new ScrollViewer { Content = _memoryList, MaxHeight = 400 };
            _root.Children.Add(_scrollViewer);

            // Edit panel (hidden)
            _editPanel = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4, Visibility = Visibility.Collapsed };
            _editKeyInput = new TextBox { PlaceholderText = "Key", IsReadOnly = true };
            AutomationProperties.SetName(_editKeyInput, "Memory key");
            _editValueInput = new TextBox { PlaceholderText = "Value", AcceptsReturn = true };
            AutomationProperties.SetName(_editValueInput, "Memory value");
            var editButtons = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            _saveButton = new Button { Content = "Save" };
            _saveButton.Click += (s, e) => Send(WidgetEvent.Save);
            _cancelButton = new Button { Content = "Cancel" };
            _cancelButton.Click += (s, e) => Send(WidgetEvent.Cancel);
            editButtons.Children.Add(_saveButton);
            editButtons.Children.Add(_cancelButton);
            _editPanel.Children.Add(_editKeyInput);
            _editPanel.Children.Add(_editValueInput);
            _editPanel.Children.Add(editButtons);
            _root.Children.Add(_editPanel);

            // Confirm delete panel (hidden)
            _confirmPanel = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4, Visibility = Visibility.Collapsed };
            _confirmText = new TextBlock { Text = "Delete this memory entry?", FontSize = 13 };
            var confirmButtons = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            _confirmDeleteButton = new Button { Content = "Delete" };
            _confirmDeleteButton.Click += (s, e) => Send(WidgetEvent.ConfirmDelete);
            _cancelDeleteButton = new Button { Content = "Cancel" };
            _cancelDeleteButton.Click += (s, e) => Send(WidgetEvent.CancelDelete);
            confirmButtons.Children.Add(_confirmDeleteButton);
            confirmButtons.Children.Add(_cancelDeleteButton);
            _confirmPanel.Children.Add(_confirmText);
            _confirmPanel.Children.Add(confirmButtons);
            _root.Children.Add(_confirmPanel);

            this.Content = _root;
            AutomationProperties.SetName(this, "Inspector panel for viewing and managing agent memory entries");
        }

        public void AddEntry(string key, string value, string type = "semantic", string timestamp = null)
        {
            var entry = new StackPanel { Orientation = Orientation.Vertical, Spacing = 2, Padding = new Thickness(8) };
            entry.Background = new SolidColorBrush(Colors.Transparent);

            var header = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            var keyText = new TextBlock { Text = key, FontSize = 13, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
            var typeTag = new TextBlock { Text = type, FontSize = 11, Opacity = 0.6 };
            header.Children.Add(keyText);
            header.Children.Add(typeTag);
            if (timestamp != null)
            {
                header.Children.Add(new TextBlock { Text = timestamp, FontSize = 11, Opacity = 0.5 });
            }

            var valueText = new TextBlock { Text = value, FontSize = 12, TextWrapping = TextWrapping.Wrap };

            var actions = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            var editBtn = new Button { Content = "\u270E", FontSize = 11 };
            editBtn.Click += (s, e) =>
            {
                _editingKey = key;
                _editKeyInput.Text = key;
                _editValueInput.Text = value;
                Send(WidgetEvent.Edit);
            };
            AutomationProperties.SetName(editBtn, $"Edit {key}");

            var deleteBtn = new Button { Content = "\u2717", FontSize = 11 };
            deleteBtn.Click += (s, e) =>
            {
                _editingKey = key;
                Send(WidgetEvent.Delete);
            };
            AutomationProperties.SetName(deleteBtn, $"Delete {key}");

            actions.Children.Add(editBtn);
            actions.Children.Add(deleteBtn);

            entry.Children.Add(header);
            entry.Children.Add(valueText);
            entry.Children.Add(actions);

            AutomationProperties.SetName(entry, $"Memory entry: {key}");
            _memoryList.Children.Add(entry);
        }

        public void SetStats(int total, string breakdown)
        {
            _totalCount.Text = $"{total} entries";
            _typeBreakdown.Text = breakdown;
        }

        public void Send(WidgetEvent evt)
        {
            _state = Reduce(_state, evt);
            UpdateVisuals();

            if (evt == WidgetEvent.Save) OnSave?.Invoke(_editKeyInput.Text, _editValueInput.Text);
            if (evt == WidgetEvent.ConfirmDelete && _editingKey != null) OnDelete?.Invoke(_editingKey);
        }

        private void UpdateVisuals()
        {
            _editPanel.Visibility = _state == WidgetState.Editing ? Visibility.Visible : Visibility.Collapsed;
            _confirmPanel.Visibility = _state == WidgetState.Confirming ? Visibility.Visible : Visibility.Collapsed;
            _clearSearchButton.Visibility = _state == WidgetState.Searching ? Visibility.Visible : Visibility.Collapsed;
        }

        private WidgetState Reduce(WidgetState state, WidgetEvent evt) => state switch
        {
            WidgetState.Viewing when evt == WidgetEvent.Search => WidgetState.Searching,
            WidgetState.Viewing when evt == WidgetEvent.Edit => WidgetState.Editing,
            WidgetState.Viewing when evt == WidgetEvent.Delete => WidgetState.Confirming,
            WidgetState.Searching when evt == WidgetEvent.ClearSearch => WidgetState.Viewing,
            WidgetState.Searching when evt == WidgetEvent.Edit => WidgetState.Editing,
            WidgetState.Searching when evt == WidgetEvent.Delete => WidgetState.Confirming,
            WidgetState.Editing when evt == WidgetEvent.Save => WidgetState.Viewing,
            WidgetState.Editing when evt == WidgetEvent.Cancel => WidgetState.Viewing,
            WidgetState.Confirming when evt == WidgetEvent.ConfirmDelete => WidgetState.Viewing,
            WidgetState.Confirming when evt == WidgetEvent.CancelDelete => WidgetState.Viewing,
            _ => state
        };
    }
}
