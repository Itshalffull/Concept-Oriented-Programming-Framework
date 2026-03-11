using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System;

namespace Clef.Surface.Widgets.Concepts.ProcessFoundation
{
    public sealed partial class VariableInspector : UserControl
    {
        private enum WidgetState { Idle, Editing, Searching, Confirming }
        private enum WidgetEvent { Edit, Save, Cancel, Search, ClearSearch, Delete, ConfirmDelete, CancelDelete }

        private WidgetState _state = WidgetState.Idle;
        private readonly StackPanel _root;
        private readonly TextBlock _title;
        private readonly TextBox _searchInput;
        private readonly Button _clearSearchButton;
        private readonly ScrollViewer _scrollViewer;
        private readonly StackPanel _variableList;
        private readonly StackPanel _editPanel;
        private readonly TextBlock _editKeyLabel;
        private readonly TextBox _editValueInput;
        private readonly ComboBox _editTypeCombo;
        private readonly StackPanel _editButtons;
        private readonly StackPanel _confirmPanel;
        private string _editingKey = null;

        public event Action<string, string> OnSave;
        public event Action<string> OnDelete;

        public VariableInspector()
        {
            _root = new StackPanel { Orientation = Orientation.Vertical, Spacing = 8, Padding = new Thickness(12) };

            // Header
            _title = new TextBlock { Text = "Variables", FontSize = 16, FontWeight = Microsoft.UI.Text.FontWeights.Bold };
            _root.Children.Add(_title);

            // Search
            var searchBar = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            _searchInput = new TextBox { PlaceholderText = "Search variables...", Width = 200 };
            AutomationProperties.SetName(_searchInput, "Search variables");
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

            // Variable list
            _variableList = new StackPanel { Orientation = Orientation.Vertical, Spacing = 2 };
            _scrollViewer = new ScrollViewer { Content = _variableList, MaxHeight = 400 };
            _root.Children.Add(_scrollViewer);

            // Edit panel (hidden)
            _editPanel = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4, Visibility = Visibility.Collapsed };
            _editKeyLabel = new TextBlock { Text = "", FontSize = 13, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
            _editTypeCombo = new ComboBox { Width = 120 };
            _editTypeCombo.Items.Add("string");
            _editTypeCombo.Items.Add("number");
            _editTypeCombo.Items.Add("boolean");
            _editTypeCombo.Items.Add("object");
            _editTypeCombo.Items.Add("array");
            _editTypeCombo.SelectedIndex = 0;
            AutomationProperties.SetName(_editTypeCombo, "Variable type");
            _editValueInput = new TextBox { PlaceholderText = "Value", AcceptsReturn = true, TextWrapping = TextWrapping.Wrap };
            AutomationProperties.SetName(_editValueInput, "Variable value");
            _editButtons = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            var saveBtn = new Button { Content = "Save" };
            saveBtn.Click += (s, e) =>
            {
                Send(WidgetEvent.Save);
                if (_editingKey != null) OnSave?.Invoke(_editingKey, _editValueInput.Text);
            };
            var cancelBtn = new Button { Content = "Cancel" };
            cancelBtn.Click += (s, e) => Send(WidgetEvent.Cancel);
            _editButtons.Children.Add(saveBtn);
            _editButtons.Children.Add(cancelBtn);
            _editPanel.Children.Add(_editKeyLabel);
            _editPanel.Children.Add(_editTypeCombo);
            _editPanel.Children.Add(_editValueInput);
            _editPanel.Children.Add(_editButtons);
            _root.Children.Add(_editPanel);

            // Confirm delete panel (hidden)
            _confirmPanel = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4, Visibility = Visibility.Collapsed };
            _confirmPanel.Children.Add(new TextBlock { Text = "Delete this variable?", FontSize = 13 });
            var confirmButtons = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
            var deleteBtn = new Button { Content = "Delete" };
            deleteBtn.Click += (s, e) =>
            {
                Send(WidgetEvent.ConfirmDelete);
                if (_editingKey != null) OnDelete?.Invoke(_editingKey);
            };
            var cancelDeleteBtn = new Button { Content = "Cancel" };
            cancelDeleteBtn.Click += (s, e) => Send(WidgetEvent.CancelDelete);
            confirmButtons.Children.Add(deleteBtn);
            confirmButtons.Children.Add(cancelDeleteBtn);
            _confirmPanel.Children.Add(confirmButtons);
            _root.Children.Add(_confirmPanel);

            this.Content = _root;
            AutomationProperties.SetName(this, "Key-value inspector panel for process runtime variables");
        }

        public void AddVariable(string key, string value, string type = "string")
        {
            var row = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8, Padding = new Thickness(8, 4, 8, 4) };

            var keyText = new TextBlock { Text = key, FontSize = 13, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold, Width = 120, VerticalAlignment = VerticalAlignment.Center };
            var typeTag = new TextBlock { Text = type, FontSize = 10, Opacity = 0.5, Width = 50, VerticalAlignment = VerticalAlignment.Center };
            var valueText = new TextBlock { Text = value, FontSize = 12, TextWrapping = TextWrapping.NoWrap, TextTrimming = TextTrimming.CharacterEllipsis, MaxWidth = 200, VerticalAlignment = VerticalAlignment.Center };

            var actions = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 2 };
            var editBtn = new Button { Content = "\u270E", FontSize = 10 };
            editBtn.Click += (s, e) =>
            {
                _editingKey = key;
                _editKeyLabel.Text = key;
                _editValueInput.Text = value;
                for (int i = 0; i < _editTypeCombo.Items.Count; i++)
                    if (_editTypeCombo.Items[i].ToString() == type) _editTypeCombo.SelectedIndex = i;
                Send(WidgetEvent.Edit);
            };
            AutomationProperties.SetName(editBtn, $"Edit {key}");
            var delBtn = new Button { Content = "\u2717", FontSize = 10 };
            delBtn.Click += (s, e) =>
            {
                _editingKey = key;
                Send(WidgetEvent.Delete);
            };
            AutomationProperties.SetName(delBtn, $"Delete {key}");
            actions.Children.Add(editBtn);
            actions.Children.Add(delBtn);

            row.Children.Add(keyText);
            row.Children.Add(typeTag);
            row.Children.Add(valueText);
            row.Children.Add(actions);

            AutomationProperties.SetName(row, $"{key}: {value} ({type})");
            _variableList.Children.Add(row);
        }

        public void Send(WidgetEvent evt)
        {
            _state = Reduce(_state, evt);
            _editPanel.Visibility = _state == WidgetState.Editing ? Visibility.Visible : Visibility.Collapsed;
            _confirmPanel.Visibility = _state == WidgetState.Confirming ? Visibility.Visible : Visibility.Collapsed;
            _clearSearchButton.Visibility = _state == WidgetState.Searching ? Visibility.Visible : Visibility.Collapsed;
        }

        private WidgetState Reduce(WidgetState state, WidgetEvent evt) => state switch
        {
            WidgetState.Idle when evt == WidgetEvent.Edit => WidgetState.Editing,
            WidgetState.Idle when evt == WidgetEvent.Search => WidgetState.Searching,
            WidgetState.Idle when evt == WidgetEvent.Delete => WidgetState.Confirming,
            WidgetState.Searching when evt == WidgetEvent.ClearSearch => WidgetState.Idle,
            WidgetState.Searching when evt == WidgetEvent.Edit => WidgetState.Editing,
            WidgetState.Editing when evt == WidgetEvent.Save => WidgetState.Idle,
            WidgetState.Editing when evt == WidgetEvent.Cancel => WidgetState.Idle,
            WidgetState.Confirming when evt == WidgetEvent.ConfirmDelete => WidgetState.Idle,
            WidgetState.Confirming when evt == WidgetEvent.CancelDelete => WidgetState.Idle,
            _ => state
        };
    }
}
