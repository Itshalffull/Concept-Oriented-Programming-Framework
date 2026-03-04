// ============================================================
// Clef Surface WinUI Widget — Breadcrumb
//
// Displays a hierarchical navigation trail of links. Maps the
// breadcrumb.widget spec to WinUI 3 BreadcrumbBar.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace Clef.Surface.WinUI.Widgets.Navigation;

public sealed class ClefBreadcrumb : UserControl
{
    public static readonly DependencyProperty ItemsProperty =
        DependencyProperty.Register(nameof(Items), typeof(IList<string>), typeof(ClefBreadcrumb),
            new PropertyMetadata(null, OnPropertyChanged));

    public IList<string> Items { get => (IList<string>)GetValue(ItemsProperty); set => SetValue(ItemsProperty, value); }

    public event System.EventHandler<string> ItemClicked;

    private readonly BreadcrumbBar _breadcrumb;

    public ClefBreadcrumb()
    {
        _breadcrumb = new BreadcrumbBar();
        _breadcrumb.ItemClicked += (s, e) => ItemClicked?.Invoke(this, e.Item?.ToString());
        Content = _breadcrumb;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefBreadcrumb)d).UpdateVisual();

    private void UpdateVisual()
    {
        _breadcrumb.ItemsSource = Items ?? new ObservableCollection<string>();
    }
}
