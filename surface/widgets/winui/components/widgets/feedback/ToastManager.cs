// ============================================================
// Clef Surface WinUI Widget — ToastManager
//
// Container that manages a stack of toast notifications.
// Controls ordering, maximum visible count, and lifecycle of
// individual toasts. Auto-dismisses toasts after configured
// duration.
//
// Adapts the toast-manager.widget spec to WinUI 3 StackPanel
// with InfoBar toast children and DispatcherTimer auto-dismiss.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Collections.Generic;
using System.Linq;

namespace Clef.Surface.WinUI.Widgets.Feedback;

public record ToastItem(string Id, string Variant = "info", string Title = "", string Description = null, int DurationMs = 5000);

public sealed class ClefToastManager : UserControl
{
    public static readonly DependencyProperty MaxVisibleProperty =
        DependencyProperty.Register(nameof(MaxVisible), typeof(int), typeof(ClefToastManager),
            new PropertyMetadata(5));

    public int MaxVisible { get => (int)GetValue(MaxVisibleProperty); set => SetValue(MaxVisibleProperty, value); }

    private readonly List<ToastItem> _toasts = new();
    private readonly StackPanel _root;
    private readonly TextBlock _overflowText;

    public ClefToastManager()
    {
        _root = new StackPanel { Spacing = 4, Padding = new Thickness(16) };
        _overflowText = new TextBlock { Opacity = 0.6, Visibility = Visibility.Collapsed, HorizontalAlignment = HorizontalAlignment.Center };
        _root.Children.Add(_overflowText);
        Content = _root;
    }

    public void Show(ToastItem toast)
    {
        _toasts.Add(toast);
        RebuildToasts();
        if (toast.DurationMs > 0)
        {
            var timer = new DispatcherTimer { Interval = System.TimeSpan.FromMilliseconds(toast.DurationMs) };
            timer.Tick += (s, e) => { timer.Stop(); Dismiss(toast.Id); };
            timer.Start();
        }
    }

    public void Dismiss(string id)
    {
        _toasts.RemoveAll(t => t.Id == id);
        RebuildToasts();
    }

    public void Clear()
    {
        _toasts.Clear();
        RebuildToasts();
    }

    private void RebuildToasts()
    {
        // Remove all except overflow text
        while (_root.Children.Count > 1)
            _root.Children.RemoveAt(0);

        var visible = _toasts.Take(MaxVisible).ToList();
        var overflow = _toasts.Count - MaxVisible;

        for (int i = visible.Count - 1; i >= 0; i--)
        {
            var toast = visible[i];
            var infoBar = new InfoBar
            {
                Title = toast.Title,
                Message = toast.Description ?? "",
                IsOpen = true,
                IsClosable = true,
                Severity = toast.Variant switch
                {
                    "success" => InfoBarSeverity.Success,
                    "warning" => InfoBarSeverity.Warning,
                    "error" => InfoBarSeverity.Error,
                    _ => InfoBarSeverity.Informational
                }
            };
            var id = toast.Id;
            infoBar.CloseButtonClick += (s, e) => Dismiss(id);
            _root.Children.Insert(0, infoBar);
        }

        if (overflow > 0)
        {
            _overflowText.Text = $"+{overflow} more notification(s)";
            _overflowText.Visibility = Visibility.Visible;
        }
        else
        {
            _overflowText.Visibility = Visibility.Collapsed;
        }
    }
}
