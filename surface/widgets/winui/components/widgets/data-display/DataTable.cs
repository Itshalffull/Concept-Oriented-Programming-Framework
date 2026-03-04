// ============================================================
// Clef Surface WinUI Widget — DataTable
//
// Tabular data display with sortable columns, row selection,
// and optional pagination. Maps the datatable.widget spec to
// WinUI 3 DataGrid-style ListView with GridView.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Collections.Generic;

namespace Clef.Surface.WinUI.Widgets.DataDisplay;

public sealed class ClefDataTable : UserControl
{
    public static readonly DependencyProperty IsSelectableProperty =
        DependencyProperty.Register(nameof(IsSelectable), typeof(bool), typeof(ClefDataTable),
            new PropertyMetadata(false, OnPropertyChanged));

    public static readonly DependencyProperty IsSortableProperty =
        DependencyProperty.Register(nameof(IsSortable), typeof(bool), typeof(ClefDataTable),
            new PropertyMetadata(true));

    public bool IsSelectable { get => (bool)GetValue(IsSelectableProperty); set => SetValue(IsSelectableProperty, value); }
    public bool IsSortable { get => (bool)GetValue(IsSortableProperty); set => SetValue(IsSortableProperty, value); }

    public event System.EventHandler<object> RowSelected;
    public event System.EventHandler<string> ColumnSorted;

    private readonly StackPanel _root;
    private readonly StackPanel _headerRow;
    private readonly ListView _listView;
    private readonly List<string> _columns = new();

    public ClefDataTable()
    {
        _headerRow = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 1 };
        _listView = new ListView();
        _listView.SelectionChanged += (s, e) =>
        {
            if (_listView.SelectedItem != null)
                RowSelected?.Invoke(this, _listView.SelectedItem);
        };
        _root = new StackPanel();
        _root.Children.Add(_headerRow);
        _root.Children.Add(_listView);
        Content = _root;
        UpdateVisual();
    }

    public void SetColumns(IEnumerable<string> columns)
    {
        _columns.Clear();
        _headerRow.Children.Clear();
        foreach (var col in columns)
        {
            _columns.Add(col);
            var btn = new Button
            {
                Content = col,
                MinWidth = 100,
                FontWeight = Microsoft.UI.Text.FontWeights.Bold
            };
            string colName = col;
            btn.Click += (s, e) => { if (IsSortable) ColumnSorted?.Invoke(this, colName); };
            _headerRow.Children.Add(btn);
        }
    }

    public void SetItemsSource(object source) => _listView.ItemsSource = source;
    public void SetItemTemplate(DataTemplate template) => _listView.ItemTemplate = template;

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefDataTable)d).UpdateVisual();

    private void UpdateVisual()
    {
        _listView.SelectionMode = IsSelectable ? ListViewSelectionMode.Single : ListViewSelectionMode.None;
    }
}
