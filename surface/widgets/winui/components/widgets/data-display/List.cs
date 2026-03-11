// ============================================================
// Clef Surface WinUI Widget — List
//
// Scrollable list of items with optional selection. Supports
// single and multi-select modes. Maps the list.widget spec to
// WinUI 3 ListView.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.DataDisplay;

public sealed class ClefList : UserControl
{
    public static readonly DependencyProperty SelectionModeProperty =
        DependencyProperty.Register(nameof(SelectionMode), typeof(string), typeof(ClefList),
            new PropertyMetadata("none", OnPropertyChanged));

    public string SelectionMode { get => (string)GetValue(SelectionModeProperty); set => SetValue(SelectionModeProperty, value); }

    public event System.EventHandler<object> ItemSelected;

    private readonly ListView _listView;

    public ClefList()
    {
        _listView = new ListView();
        _listView.SelectionChanged += (s, e) =>
        {
            if (_listView.SelectedItem != null)
                ItemSelected?.Invoke(this, _listView.SelectedItem);
        };
        Content = _listView;
        UpdateVisual();
    }

    public void SetItemsSource(object source) => _listView.ItemsSource = source;
    public void SetItemTemplate(DataTemplate template) => _listView.ItemTemplate = template;

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefList)d).UpdateVisual();

    private void UpdateVisual()
    {
        _listView.SelectionMode = SelectionMode switch
        {
            "single" => ListViewSelectionMode.Single,
            "multiple" => ListViewSelectionMode.Multiple,
            _ => ListViewSelectionMode.None
        };
    }
}
