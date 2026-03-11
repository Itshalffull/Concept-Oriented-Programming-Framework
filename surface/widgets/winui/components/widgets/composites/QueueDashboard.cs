// ============================================================
// Clef Surface WinUI Widget — QueueDashboard
//
// Dashboard for monitoring job/task queues. Shows pending,
// active, completed, and failed counts with a job list. Maps
// the queuedashboard.widget spec to WinUI 3 Grid layout.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Composites;

public sealed class ClefQueueDashboard : UserControl
{
    public static readonly DependencyProperty PendingCountProperty =
        DependencyProperty.Register(nameof(PendingCount), typeof(int), typeof(ClefQueueDashboard),
            new PropertyMetadata(0, OnPropertyChanged));

    public static readonly DependencyProperty ActiveCountProperty =
        DependencyProperty.Register(nameof(ActiveCount), typeof(int), typeof(ClefQueueDashboard),
            new PropertyMetadata(0, OnPropertyChanged));

    public static readonly DependencyProperty CompletedCountProperty =
        DependencyProperty.Register(nameof(CompletedCount), typeof(int), typeof(ClefQueueDashboard),
            new PropertyMetadata(0, OnPropertyChanged));

    public static readonly DependencyProperty FailedCountProperty =
        DependencyProperty.Register(nameof(FailedCount), typeof(int), typeof(ClefQueueDashboard),
            new PropertyMetadata(0, OnPropertyChanged));

    public int PendingCount { get => (int)GetValue(PendingCountProperty); set => SetValue(PendingCountProperty, value); }
    public int ActiveCount { get => (int)GetValue(ActiveCountProperty); set => SetValue(ActiveCountProperty, value); }
    public int CompletedCount { get => (int)GetValue(CompletedCountProperty); set => SetValue(CompletedCountProperty, value); }
    public int FailedCount { get => (int)GetValue(FailedCountProperty); set => SetValue(FailedCountProperty, value); }

    public event RoutedEventHandler RetryFailed;

    private readonly StackPanel _root;
    private readonly StackPanel _stats;
    private readonly TextBlock _pendingText;
    private readonly TextBlock _activeText;
    private readonly TextBlock _completedText;
    private readonly TextBlock _failedText;
    private readonly ListView _jobList;
    private readonly Button _retryBtn;

    public ClefQueueDashboard()
    {
        _pendingText = new TextBlock();
        _activeText = new TextBlock();
        _completedText = new TextBlock();
        _failedText = new TextBlock();
        _stats = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 24 };
        _stats.Children.Add(_pendingText);
        _stats.Children.Add(_activeText);
        _stats.Children.Add(_completedText);
        _stats.Children.Add(_failedText);
        _jobList = new ListView();
        _retryBtn = new Button { Content = "Retry Failed" };
        _retryBtn.Click += (s, e) => RetryFailed?.Invoke(this, new RoutedEventArgs());
        _root = new StackPanel { Spacing = 12, Padding = new Thickness(16) };
        _root.Children.Add(new TextBlock { Text = "Queue Dashboard", FontSize = 18, FontWeight = Microsoft.UI.Text.FontWeights.Bold });
        _root.Children.Add(_stats);
        _root.Children.Add(_jobList);
        _root.Children.Add(_retryBtn);
        Content = _root;
        UpdateVisual();
    }

    public void SetJobsSource(object source) => _jobList.ItemsSource = source;

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefQueueDashboard)d).UpdateVisual();

    private void UpdateVisual()
    {
        _pendingText.Text = $"Pending: {PendingCount}";
        _activeText.Text = $"Active: {ActiveCount}";
        _completedText.Text = $"Completed: {CompletedCount}";
        _failedText.Text = $"Failed: {FailedCount}";
        _retryBtn.IsEnabled = FailedCount > 0;
    }
}
