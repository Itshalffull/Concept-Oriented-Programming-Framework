using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class MemoryInspector : UserControl
    {
        private string _state = "viewing";

        public MemoryInspector()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Inspector panel for viewing and managing");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
