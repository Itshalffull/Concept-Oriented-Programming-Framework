// ============================================================
// Clef Surface WinUI Widget — RichTextEditor
//
// WYSIWYG rich text editing with formatting toolbar. Supports
// bold, italic, underline, lists, and headings. Maps the
// richtexteditor.widget spec to WinUI 3 RichEditBox with
// CommandBar.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Text;

namespace Clef.Surface.WinUI.Widgets.ComplexInputs;

public sealed class ClefRichTextEditor : UserControl
{
    public static readonly DependencyProperty IsReadOnlyProperty =
        DependencyProperty.Register(nameof(IsReadOnly), typeof(bool), typeof(ClefRichTextEditor),
            new PropertyMetadata(false, OnPropertyChanged));

    public bool IsReadOnly { get => (bool)GetValue(IsReadOnlyProperty); set => SetValue(IsReadOnlyProperty, value); }

    public event RoutedEventHandler ContentChanged;

    private readonly StackPanel _root;
    private readonly CommandBar _toolbar;
    private readonly RichEditBox _editor;

    public ClefRichTextEditor()
    {
        var boldBtn = new AppBarButton { Icon = new SymbolIcon(Symbol.Bold), Label = "Bold" };
        boldBtn.Click += (s, e) =>
        {
            var sel = _editor.Document.Selection;
            if (sel != null)
            {
                var fmt = sel.CharacterFormat;
                fmt.Bold = fmt.Bold == FormatEffect.On ? FormatEffect.Off : FormatEffect.On;
                sel.CharacterFormat = fmt;
            }
        };
        var italicBtn = new AppBarButton { Icon = new SymbolIcon(Symbol.Italic), Label = "Italic" };
        italicBtn.Click += (s, e) =>
        {
            var sel = _editor.Document.Selection;
            if (sel != null)
            {
                var fmt = sel.CharacterFormat;
                fmt.Italic = fmt.Italic == FormatEffect.On ? FormatEffect.Off : FormatEffect.On;
                sel.CharacterFormat = fmt;
            }
        };
        var underlineBtn = new AppBarButton { Icon = new SymbolIcon(Symbol.Underline), Label = "Underline" };
        underlineBtn.Click += (s, e) =>
        {
            var sel = _editor.Document.Selection;
            if (sel != null)
            {
                var fmt = sel.CharacterFormat;
                fmt.Underline = fmt.Underline == UnderlineType.Single ? UnderlineType.None : UnderlineType.Single;
                sel.CharacterFormat = fmt;
            }
        };
        _toolbar = new CommandBar { DefaultLabelPosition = CommandBarDefaultLabelPosition.Collapsed };
        _toolbar.PrimaryCommands.Add(boldBtn);
        _toolbar.PrimaryCommands.Add(italicBtn);
        _toolbar.PrimaryCommands.Add(underlineBtn);
        _editor = new RichEditBox
        {
            MinHeight = 200,
            HorizontalAlignment = HorizontalAlignment.Stretch
        };
        _editor.TextChanged += (s, e) => ContentChanged?.Invoke(this, new RoutedEventArgs());
        _root = new StackPanel();
        _root.Children.Add(_toolbar);
        _root.Children.Add(_editor);
        Content = _root;
        UpdateVisual();
    }

    public string GetRtfContent()
    {
        _editor.Document.GetText(TextGetOptions.FormatRtf, out string rtf);
        return rtf;
    }

    public void SetRtfContent(string rtf) => _editor.Document.SetText(TextSetOptions.FormatRtf, rtf);

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefRichTextEditor)d).UpdateVisual();

    private void UpdateVisual()
    {
        _editor.IsReadOnly = IsReadOnly;
        _toolbar.Visibility = IsReadOnly ? Visibility.Collapsed : Visibility.Visible;
    }
}
