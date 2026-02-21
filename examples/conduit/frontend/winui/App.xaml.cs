// Conduit Example App -- WinUI 3 Application Entry Point
// Initializes the WinUI application and creates the main window.

using Microsoft.UI.Xaml;

namespace ConduitApp;

public partial class App : Application
{
    private Window? _mainWindow;

    public App()
    {
        InitializeComponent();
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        _mainWindow = new MainWindow();
        _mainWindow.Activate();
    }
}
