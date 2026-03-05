using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class ConversationSidebar : UserControl
    {
        private string _state = "idle";

        public ConversationSidebar()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Sidebar panel listing conversation histo");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
