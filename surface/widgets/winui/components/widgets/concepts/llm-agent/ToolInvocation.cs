using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class ToolInvocation : UserControl
    {
        private string _state = "collapsed";

        public ToolInvocation()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Collapsible card displaying an LLM tool ");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
