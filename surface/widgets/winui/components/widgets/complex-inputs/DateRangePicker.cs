// ============================================================
// Clef Surface WinUI Widget — DateRangePicker
//
// Two-field date range selection with start and end dates.
// Maps the daterangepicker.widget spec to WinUI 3 paired
// CalendarDatePicker controls.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System;

namespace Clef.Surface.WinUI.Widgets.ComplexInputs;

public sealed class ClefDateRangePicker : UserControl
{
    public static readonly DependencyProperty LabelProperty =
        DependencyProperty.Register(nameof(Label), typeof(string), typeof(ClefDateRangePicker),
            new PropertyMetadata(null, OnPropertyChanged));

    public string Label { get => (string)GetValue(LabelProperty); set => SetValue(LabelProperty, value); }

    public event EventHandler<(DateTimeOffset? Start, DateTimeOffset? End)> RangeChanged;

    private readonly StackPanel _root;
    private readonly TextBlock _labelBlock;
    private readonly StackPanel _row;
    private readonly CalendarDatePicker _startPicker;
    private readonly CalendarDatePicker _endPicker;

    public ClefDateRangePicker()
    {
        _labelBlock = new TextBlock
        {
            FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
            Visibility = Visibility.Collapsed
        };
        _startPicker = new CalendarDatePicker { PlaceholderText = "Start date" };
        _endPicker = new CalendarDatePicker { PlaceholderText = "End date" };
        _startPicker.DateChanged += (s, e) => RangeChanged?.Invoke(this, (_startPicker.Date, _endPicker.Date));
        _endPicker.DateChanged += (s, e) => RangeChanged?.Invoke(this, (_startPicker.Date, _endPicker.Date));
        _row = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
        _row.Children.Add(_startPicker);
        _row.Children.Add(new TextBlock { Text = "to", VerticalAlignment = VerticalAlignment.Center });
        _row.Children.Add(_endPicker);
        _root = new StackPanel { Spacing = 4 };
        _root.Children.Add(_labelBlock);
        _root.Children.Add(_row);
        Content = _root;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefDateRangePicker)d).UpdateVisual();

    private void UpdateVisual()
    {
        _labelBlock.Text = Label ?? "";
        _labelBlock.Visibility = string.IsNullOrEmpty(Label) ? Visibility.Collapsed : Visibility.Visible;
    }
}
