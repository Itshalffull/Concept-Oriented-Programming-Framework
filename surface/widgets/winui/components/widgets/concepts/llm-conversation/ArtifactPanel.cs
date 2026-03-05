using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class ArtifactPanel : UserControl
    {
        private string _state = "open";

        public ArtifactPanel()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Side panel for displaying and interactin");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
