using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class ExecutionOverlay : UserControl
    {
        private string _state = "idle";

        public ExecutionOverlay()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Runtime state overlay for process execut");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
