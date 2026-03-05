using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class TraceTree : UserControl
    {
        private string _state = "idle";

        public TraceTree()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Hierarchical execution trace viewer disp");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
