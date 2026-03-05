using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class MessageBranchNav : UserControl
    {
        private string _state = "viewing";

        public MessageBranchNav()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Navigation control for conversation bran");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
