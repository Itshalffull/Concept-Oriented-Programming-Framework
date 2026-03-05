using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class ToolCallDetail : UserControl
    {
        private string _state = "idle";

        public ToolCallDetail()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Detailed view of a single tool call with");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
