using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class StreamText : UserControl
    {
        private string _state = "idle";

        public StreamText()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Token-by-token text renderer for streami");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
