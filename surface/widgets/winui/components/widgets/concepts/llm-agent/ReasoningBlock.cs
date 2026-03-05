using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class ReasoningBlock : UserControl
    {
        private string _state = "collapsed";

        public ReasoningBlock()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Collapsible display for LLM chain-of-tho");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
