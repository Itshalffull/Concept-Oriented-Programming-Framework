// ============================================================
// Clef Surface WinUI Widget — Pagination
//
// Page navigation control with previous/next and page number
// buttons. Maps the pagination.widget spec to WinUI 3
// StackPanel with Button controls.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System;

namespace Clef.Surface.WinUI.Widgets.Navigation;

public sealed class ClefPagination : UserControl
{
    public static readonly DependencyProperty CurrentPageProperty =
        DependencyProperty.Register(nameof(CurrentPage), typeof(int), typeof(ClefPagination),
            new PropertyMetadata(1, OnPropertyChanged));

    public static readonly DependencyProperty TotalPagesProperty =
        DependencyProperty.Register(nameof(TotalPages), typeof(int), typeof(ClefPagination),
            new PropertyMetadata(1, OnPropertyChanged));

    public int CurrentPage { get => (int)GetValue(CurrentPageProperty); set => SetValue(CurrentPageProperty, value); }
    public int TotalPages { get => (int)GetValue(TotalPagesProperty); set => SetValue(TotalPagesProperty, value); }

    public event EventHandler<int> PageChanged;

    private readonly StackPanel _root;
    private readonly Button _prevBtn;
    private readonly Button _nextBtn;
    private readonly StackPanel _pageNumbers;

    public ClefPagination()
    {
        _prevBtn = new Button { Content = new SymbolIcon(Symbol.Back) };
        _prevBtn.Click += (s, e) =>
        {
            if (CurrentPage > 1) { CurrentPage--; PageChanged?.Invoke(this, CurrentPage); }
        };
        _nextBtn = new Button { Content = new SymbolIcon(Symbol.Forward) };
        _nextBtn.Click += (s, e) =>
        {
            if (CurrentPage < TotalPages) { CurrentPage++; PageChanged?.Invoke(this, CurrentPage); }
        };
        _pageNumbers = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
        _root = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
        _root.Children.Add(_prevBtn);
        _root.Children.Add(_pageNumbers);
        _root.Children.Add(_nextBtn);
        Content = _root;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefPagination)d).UpdateVisual();

    private void UpdateVisual()
    {
        _prevBtn.IsEnabled = CurrentPage > 1;
        _nextBtn.IsEnabled = CurrentPage < TotalPages;
        _pageNumbers.Children.Clear();
        int start = Math.Max(1, CurrentPage - 2);
        int end = Math.Min(TotalPages, CurrentPage + 2);
        for (int i = start; i <= end; i++)
        {
            int page = i;
            var btn = new Button { Content = i.ToString(), MinWidth = 32 };
            if (i == CurrentPage)
                btn.Style = Application.Current.Resources["AccentButtonStyle"] as Style;
            btn.Click += (s, e) => { CurrentPage = page; PageChanged?.Invoke(this, page); };
            _pageNumbers.Children.Add(btn);
        }
    }
}
