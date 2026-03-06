using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System;
using System.Collections.Generic;

namespace Clef.Surface.Widgets.Concepts.LlmAgent
{
    public sealed partial class TaskPlanList : UserControl
    {
        private enum WidgetState { Idle, TaskSelected, Editing, Reordering }
        private enum WidgetEvent { SelectTask, Deselect, Edit, Save, Cancel, Reorder, DoneReorder }

        private WidgetState _state = WidgetState.Idle;
        private readonly StackPanel _root;
        private readonly TextBlock _title;
        private readonly StackPanel _statusBar;
        private readonly TextBlock _progressText;
        private readonly ProgressBar _progressBar;
        private readonly ScrollViewer _scrollViewer;
        private readonly StackPanel _taskList;
        private readonly StackPanel _detailPanel;
        private readonly TextBlock _detailTitle;
        private readonly TextBlock _detailDescription;
        private readonly TextBlock _detailStatus;
        private readonly Button _closeDetailButton;
        private int _selectedIndex = -1;

        public event Action<int> OnTaskSelect;

        public TaskPlanList()
        {
            _root = new StackPanel { Orientation = Orientation.Vertical, Spacing = 8, Padding = new Thickness(12) };

            // Header
            _title = new TextBlock { Text = "Task Plan", FontSize = 16, FontWeight = Microsoft.UI.Text.FontWeights.Bold };
            _root.Children.Add(_title);

            // Progress bar
            _statusBar = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4 };
            _progressText = new TextBlock { Text = "0 / 0 tasks complete", FontSize = 12, Opacity = 0.7 };
            _progressBar = new ProgressBar { Minimum = 0, Maximum = 100, Value = 0, Height = 6 };
            AutomationProperties.SetName(_progressBar, "Task completion progress");
            _statusBar.Children.Add(_progressText);
            _statusBar.Children.Add(_progressBar);
            _root.Children.Add(_statusBar);

            // Task list
            _taskList = new StackPanel { Orientation = Orientation.Vertical, Spacing = 2 };
            _scrollViewer = new ScrollViewer { Content = _taskList, MaxHeight = 400 };
            _root.Children.Add(_scrollViewer);

            // Detail panel (hidden)
            _detailPanel = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4, Visibility = Visibility.Collapsed, Padding = new Thickness(8) };
            _detailPanel.Background = new SolidColorBrush(Colors.Transparent);
            var detailHeader = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            _detailTitle = new TextBlock { Text = "", FontSize = 14, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
            _closeDetailButton = new Button { Content = "\u2715", FontSize = 11 };
            _closeDetailButton.Click += (s, e) => Send(WidgetEvent.Deselect);
            AutomationProperties.SetName(_closeDetailButton, "Close task detail");
            detailHeader.Children.Add(_detailTitle);
            detailHeader.Children.Add(_closeDetailButton);
            _detailDescription = new TextBlock { Text = "", FontSize = 12, TextWrapping = TextWrapping.Wrap };
            _detailStatus = new TextBlock { Text = "", FontSize = 12, Opacity = 0.7 };
            _detailPanel.Children.Add(detailHeader);
            _detailPanel.Children.Add(_detailDescription);
            _detailPanel.Children.Add(_detailStatus);
            _root.Children.Add(_detailPanel);

            this.Content = _root;
            AutomationProperties.SetName(this, "Goal decomposition display showing a hierarchical task plan");
        }

        public void AddTask(string title, string description, string status = "pending", int depth = 0)
        {
            string statusIcon = status switch
            {
                "complete" => "\u2611",
                "running" => "\u25CF",
                "failed" => "\u2717",
                "skipped" => "\u2014",
                _ => "\u2610"
            };

            var taskPanel = new StackPanel
            {
                Orientation = Orientation.Horizontal,
                Spacing = 8,
                Padding = new Thickness(depth * 16 + 4, 4, 4, 4)
            };

            var icon = new TextBlock { Text = statusIcon, FontSize = 13, VerticalAlignment = VerticalAlignment.Center };
            var titleText = new TextBlock { Text = title, FontSize = 13, VerticalAlignment = VerticalAlignment.Center };

            if (status == "running")
            {
                var ring = new ProgressRing { IsActive = true, Width = 12, Height = 12 };
                taskPanel.Children.Add(ring);
            }
            else
            {
                taskPanel.Children.Add(icon);
            }

            taskPanel.Children.Add(titleText);

            if (status == "complete")
            {
                titleText.Opacity = 0.6;
            }

            int index = _taskList.Children.Count;
            taskPanel.PointerPressed += (s, e) =>
            {
                _selectedIndex = index;
                _detailTitle.Text = title;
                _detailDescription.Text = description;
                _detailStatus.Text = $"Status: {status}";
                Send(WidgetEvent.SelectTask);
                OnTaskSelect?.Invoke(index);
            };

            AutomationProperties.SetName(taskPanel, $"Task: {title} - {status}");
            _taskList.Children.Add(taskPanel);
        }

        public void SetProgress(int completed, int total)
        {
            _progressText.Text = $"{completed} / {total} tasks complete";
            _progressBar.Value = total > 0 ? (completed * 100.0 / total) : 0;
        }

        public void Send(WidgetEvent evt)
        {
            _state = Reduce(_state, evt);
            _detailPanel.Visibility = _state == WidgetState.TaskSelected ? Visibility.Visible : Visibility.Collapsed;
        }

        private WidgetState Reduce(WidgetState state, WidgetEvent evt) => state switch
        {
            WidgetState.Idle when evt == WidgetEvent.SelectTask => WidgetState.TaskSelected,
            WidgetState.TaskSelected when evt == WidgetEvent.Deselect => WidgetState.Idle,
            WidgetState.TaskSelected when evt == WidgetEvent.SelectTask => WidgetState.TaskSelected,
            WidgetState.TaskSelected when evt == WidgetEvent.Edit => WidgetState.Editing,
            WidgetState.Editing when evt == WidgetEvent.Save => WidgetState.TaskSelected,
            WidgetState.Editing when evt == WidgetEvent.Cancel => WidgetState.TaskSelected,
            _ => state
        };
    }
}
