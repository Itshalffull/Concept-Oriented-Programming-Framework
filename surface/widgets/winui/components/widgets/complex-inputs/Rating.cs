// ============================================================
// Clef Surface WinUI Widget — Rating
//
// Star-based rating input with configurable max stars and
// half-star precision. Maps the rating.widget spec to WinUI 3
// RatingControl.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.ComplexInputs;

public sealed class ClefRating : UserControl
{
    public static readonly DependencyProperty ValueProperty =
        DependencyProperty.Register(nameof(Value), typeof(double), typeof(ClefRating),
            new PropertyMetadata(0.0, OnPropertyChanged));

    public static readonly DependencyProperty MaxRatingProperty =
        DependencyProperty.Register(nameof(MaxRating), typeof(int), typeof(ClefRating),
            new PropertyMetadata(5, OnPropertyChanged));

    public static readonly DependencyProperty IsReadOnlyProperty =
        DependencyProperty.Register(nameof(IsReadOnly), typeof(bool), typeof(ClefRating),
            new PropertyMetadata(false, OnPropertyChanged));

    public double Value { get => (double)GetValue(ValueProperty); set => SetValue(ValueProperty, value); }
    public int MaxRating { get => (int)GetValue(MaxRatingProperty); set => SetValue(MaxRatingProperty, value); }
    public bool IsReadOnly { get => (bool)GetValue(IsReadOnlyProperty); set => SetValue(IsReadOnlyProperty, value); }

    public event System.EventHandler<double> ValueChanged;

    private readonly RatingControl _rating;

    public ClefRating()
    {
        _rating = new RatingControl();
        _rating.ValueChanged += (s, e) =>
        {
            Value = _rating.Value;
            ValueChanged?.Invoke(this, _rating.Value);
        };
        Content = _rating;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefRating)d).UpdateVisual();

    private void UpdateVisual()
    {
        _rating.Value = Value;
        _rating.MaxRating = MaxRating;
        _rating.IsReadOnly = IsReadOnly;
    }
}
