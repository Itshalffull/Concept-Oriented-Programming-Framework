// ============================================================
// Clef Surface WinUI Widget — PermissionMatrix
//
// Grid of role-permission checkboxes. Rows are roles, columns
// are permissions. Maps the permissionmatrix.widget spec to
// WinUI 3 Grid with CheckBox cells.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Collections.Generic;

namespace Clef.Surface.WinUI.Widgets.Composites;

public sealed class ClefPermissionMatrix : UserControl
{
    public event System.EventHandler<(string Role, string Permission, bool Granted)> PermissionChanged;

    private readonly ScrollViewer _scrollViewer;
    private readonly Grid _grid;
    private readonly List<string> _roles = new();
    private readonly List<string> _permissions = new();

    public ClefPermissionMatrix()
    {
        _grid = new Grid();
        _scrollViewer = new ScrollViewer
        {
            HorizontalScrollBarVisibility = ScrollBarVisibility.Auto,
            Content = _grid
        };
        Content = _scrollViewer;
    }

    public void Build(IEnumerable<string> roles, IEnumerable<string> permissions)
    {
        _roles.Clear();
        _roles.AddRange(roles);
        _permissions.Clear();
        _permissions.AddRange(permissions);
        _grid.Children.Clear();
        _grid.ColumnDefinitions.Clear();
        _grid.RowDefinitions.Clear();

        _grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(120) });
        foreach (var p in _permissions)
            _grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(100) });
        _grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        for (int c = 0; c < _permissions.Count; c++)
        {
            var header = new TextBlock
            {
                Text = _permissions[c],
                FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
                Margin = new Thickness(4)
            };
            Grid.SetRow(header, 0);
            Grid.SetColumn(header, c + 1);
            _grid.Children.Add(header);
        }
        for (int r = 0; r < _roles.Count; r++)
        {
            _grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            var roleLabel = new TextBlock { Text = _roles[r], Margin = new Thickness(4), VerticalAlignment = VerticalAlignment.Center };
            Grid.SetRow(roleLabel, r + 1);
            Grid.SetColumn(roleLabel, 0);
            _grid.Children.Add(roleLabel);
            for (int c = 0; c < _permissions.Count; c++)
            {
                string role = _roles[r], perm = _permissions[c];
                var cb = new CheckBox { Margin = new Thickness(4) };
                cb.Checked += (s, e) => PermissionChanged?.Invoke(this, (role, perm, true));
                cb.Unchecked += (s, e) => PermissionChanged?.Invoke(this, (role, perm, false));
                Grid.SetRow(cb, r + 1);
                Grid.SetColumn(cb, c + 1);
                _grid.Children.Add(cb);
            }
        }
    }
}
