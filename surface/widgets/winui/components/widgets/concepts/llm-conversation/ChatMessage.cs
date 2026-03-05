using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class ChatMessage : UserControl
    {
        private string _state = "idle";

        public ChatMessage()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Role-differentiated message container fo");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
