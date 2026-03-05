using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class AgentTimeline : UserControl
    {
        private string _state = "idle";

        public AgentTimeline()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Multi-agent communication timeline displ");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
