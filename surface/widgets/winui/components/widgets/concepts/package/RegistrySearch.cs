using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class RegistrySearch : UserControl
    {
        private string _state = "idle";

        public RegistrySearch()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Search interface for the package registr");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
