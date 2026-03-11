using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class MessageActions : UserControl
    {
        private string _state = "hidden";

        public MessageActions()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Hover-revealed toolbar for chat message ");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
