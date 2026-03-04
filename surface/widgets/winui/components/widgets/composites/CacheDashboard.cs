// ============================================================
// Clef Surface WinUI Widget — CacheDashboard
//
// Monitoring dashboard for cache health showing hit/miss rates,
// memory usage, and entry counts. Maps the cachedashboard.widget
// spec to WinUI 3 Grid with stat cards and progress indicators.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Composites;

public sealed class ClefCacheDashboard : UserControl
{
    public static readonly DependencyProperty HitRateProperty =
        DependencyProperty.Register(nameof(HitRate), typeof(double), typeof(ClefCacheDashboard),
            new PropertyMetadata(0.0, OnPropertyChanged));

    public static readonly DependencyProperty MemoryUsageProperty =
        DependencyProperty.Register(nameof(MemoryUsage), typeof(double), typeof(ClefCacheDashboard),
            new PropertyMetadata(0.0, OnPropertyChanged));

    public static readonly DependencyProperty EntryCountProperty =
        DependencyProperty.Register(nameof(EntryCount), typeof(int), typeof(ClefCacheDashboard),
            new PropertyMetadata(0, OnPropertyChanged));

    public double HitRate { get => (double)GetValue(HitRateProperty); set => SetValue(HitRateProperty, value); }
    public double MemoryUsage { get => (double)GetValue(MemoryUsageProperty); set => SetValue(MemoryUsageProperty, value); }
    public int EntryCount { get => (int)GetValue(EntryCountProperty); set => SetValue(EntryCountProperty, value); }

    public event RoutedEventHandler ClearRequested;

    private readonly StackPanel _root;
    private readonly ProgressBar _hitBar;
    private readonly ProgressBar _memBar;
    private readonly TextBlock _hitLabel;
    private readonly TextBlock _memLabel;
    private readonly TextBlock _entryLabel;
    private readonly Button _clearBtn;

    public ClefCacheDashboard()
    {
        _hitLabel = new TextBlock { FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
        _hitBar = new ProgressBar { Maximum = 100, HorizontalAlignment = HorizontalAlignment.Stretch };
        _memLabel = new TextBlock { FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
        _memBar = new ProgressBar { Maximum = 100, HorizontalAlignment = HorizontalAlignment.Stretch };
        _entryLabel = new TextBlock();
        _clearBtn = new Button { Content = "Clear Cache" };
        _clearBtn.Click += (s, e) => ClearRequested?.Invoke(this, new RoutedEventArgs());
        _root = new StackPanel { Spacing = 12, Padding = new Thickness(16) };
        _root.Children.Add(new TextBlock { Text = "Cache Dashboard", FontSize = 18, FontWeight = Microsoft.UI.Text.FontWeights.Bold });
        _root.Children.Add(_hitLabel);
        _root.Children.Add(_hitBar);
        _root.Children.Add(_memLabel);
        _root.Children.Add(_memBar);
        _root.Children.Add(_entryLabel);
        _root.Children.Add(_clearBtn);
        Content = _root;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefCacheDashboard)d).UpdateVisual();

    private void UpdateVisual()
    {
        _hitLabel.Text = $"Hit Rate: {HitRate:F1}%";
        _hitBar.Value = HitRate;
        _memLabel.Text = $"Memory Usage: {MemoryUsage:F1}%";
        _memBar.Value = MemoryUsage;
        _entryLabel.Text = $"Entries: {EntryCount:N0}";
    }
}
