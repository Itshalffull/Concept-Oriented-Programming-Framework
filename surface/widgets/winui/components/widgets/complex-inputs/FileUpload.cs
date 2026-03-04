// ============================================================
// Clef Surface WinUI Widget — FileUpload
//
// File selection with drag-and-drop zone. Displays selected
// file names and upload progress. Maps the fileupload.widget
// spec to WinUI 3 Border with FileOpenPicker integration.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Collections.Generic;

namespace Clef.Surface.WinUI.Widgets.ComplexInputs;

public sealed class ClefFileUpload : UserControl
{
    public static readonly DependencyProperty AcceptProperty =
        DependencyProperty.Register(nameof(Accept), typeof(string), typeof(ClefFileUpload),
            new PropertyMetadata("*"));

    public static readonly DependencyProperty AllowMultipleProperty =
        DependencyProperty.Register(nameof(AllowMultiple), typeof(bool), typeof(ClefFileUpload),
            new PropertyMetadata(false));

    public string Accept { get => (string)GetValue(AcceptProperty); set => SetValue(AcceptProperty, value); }
    public bool AllowMultiple { get => (bool)GetValue(AllowMultipleProperty); set => SetValue(AllowMultipleProperty, value); }

    public event System.EventHandler<IReadOnlyList<string>> FilesSelected;

    private readonly Border _dropZone;
    private readonly StackPanel _content;
    private readonly TextBlock _label;
    private readonly Button _browseBtn;
    private readonly StackPanel _fileList;

    public ClefFileUpload()
    {
        _label = new TextBlock
        {
            Text = "Drop files here or click to browse",
            HorizontalAlignment = HorizontalAlignment.Center,
            Opacity = 0.7
        };
        _browseBtn = new Button { Content = "Browse", HorizontalAlignment = HorizontalAlignment.Center };
        _browseBtn.Click += async (s, e) =>
        {
            var picker = new Windows.Storage.Pickers.FileOpenPicker();
            picker.FileTypeFilter.Add("*");
            var files = AllowMultiple
                ? await picker.PickMultipleFilesAsync()
                : new List<Windows.Storage.StorageFile> { await picker.PickSingleFileAsync() };
            var names = new List<string>();
            _fileList.Children.Clear();
            foreach (var f in files)
            {
                if (f != null)
                {
                    names.Add(f.Name);
                    _fileList.Children.Add(new TextBlock { Text = f.Name });
                }
            }
            if (names.Count > 0) FilesSelected?.Invoke(this, names);
        };
        _fileList = new StackPanel { Spacing = 4 };
        _content = new StackPanel
        {
            Spacing = 8,
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center
        };
        _content.Children.Add(new SymbolIcon(Symbol.Upload) { Width = 32, Height = 32 });
        _content.Children.Add(_label);
        _content.Children.Add(_browseBtn);
        _content.Children.Add(_fileList);
        _dropZone = new Border
        {
            BorderThickness = new Thickness(2),
            BorderBrush = new Microsoft.UI.Xaml.Media.SolidColorBrush(Microsoft.UI.Colors.LightGray),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(24),
            MinHeight = 120,
            AllowDrop = true,
            Child = _content
        };
        Content = _dropZone;
    }
}
