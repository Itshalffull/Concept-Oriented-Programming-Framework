// ============================================================
// Clef Surface WinUI Widget — MasterDetail
//
// Two-pane layout: master list on the left, detail view on the
// right. Selecting a master item displays its details. Maps
// the masterdetail.widget spec to WinUI 3 SplitView.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Composites;

public sealed class ClefMasterDetail : UserControl
{
    public static readonly DependencyProperty MasterWidthProperty =
        DependencyProperty.Register(nameof(MasterWidth), typeof(double), typeof(ClefMasterDetail),
            new PropertyMetadata(300.0, OnPropertyChanged));

    public double MasterWidth { get => (double)GetValue(MasterWidthProperty); set => SetValue(MasterWidthProperty, value); }

    public event System.EventHandler<object> ItemSelected;

    private readonly SplitView _splitView;
    private readonly ListView _masterList;
    private readonly ContentPresenter _detailPresenter;

    public ClefMasterDetail()
    {
        _masterList = new ListView { SelectionMode = ListViewSelectionMode.Single };
        _masterList.SelectionChanged += (s, e) =>
        {
            if (_masterList.SelectedItem != null)
                ItemSelected?.Invoke(this, _masterList.SelectedItem);
        };
        _detailPresenter = new ContentPresenter { Padding = new Thickness(16) };
        _splitView = new SplitView
        {
            Pane = _masterList,
            Content = _detailPresenter,
            DisplayMode = SplitViewDisplayMode.Inline,
            IsPaneOpen = true,
            OpenPaneLength = 300
        };
        Content = _splitView;
        UpdateVisual();
    }

    public void SetMasterItemsSource(object source) => _masterList.ItemsSource = source;
    public void SetMasterItemTemplate(DataTemplate template) => _masterList.ItemTemplate = template;
    public void SetDetailContent(UIElement element) => _detailPresenter.Content = element;

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefMasterDetail)d).UpdateVisual();

    private void UpdateVisual()
    {
        _splitView.OpenPaneLength = MasterWidth;
    }
}
