using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class DependencyTree : UserControl
    {
        private string _state = "idle";

        public DependencyTree()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Interactive dependency tree viewer for p");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
