using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class InlineCitation : UserControl
    {
        private string _state = "idle";

        public InlineCitation()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Numbered inline citation reference rende");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
