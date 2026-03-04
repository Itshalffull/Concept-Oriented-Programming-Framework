// ============================================================
// Clef Surface WinUI Widget — CalendarView
//
// Monthly calendar display with date selection and optional
// event markers. Maps the calendarview.widget spec to WinUI 3
// CalendarView control.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System;

namespace Clef.Surface.WinUI.Widgets.DataDisplay;

public sealed class ClefCalendarView : UserControl
{
    public static readonly DependencyProperty SelectionModeProperty =
        DependencyProperty.Register(nameof(SelectionMode), typeof(string), typeof(ClefCalendarView),
            new PropertyMetadata("single", OnPropertyChanged));

    public string SelectionMode { get => (string)GetValue(SelectionModeProperty); set => SetValue(SelectionModeProperty, value); }

    public event EventHandler<DateTimeOffset> DateSelected;

    private readonly CalendarView _calendar;

    public ClefCalendarView()
    {
        _calendar = new CalendarView();
        _calendar.SelectedDatesChanged += (s, e) =>
        {
            if (_calendar.SelectedDates.Count > 0)
                DateSelected?.Invoke(this, _calendar.SelectedDates[0]);
        };
        Content = _calendar;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefCalendarView)d).UpdateVisual();

    private void UpdateVisual()
    {
        _calendar.SelectionMode = SelectionMode switch
        {
            "multiple" => CalendarViewSelectionMode.Multiple,
            "none" => CalendarViewSelectionMode.None,
            _ => CalendarViewSelectionMode.Single
        };
    }
}
