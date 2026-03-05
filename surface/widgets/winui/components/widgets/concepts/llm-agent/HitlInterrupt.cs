using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class HitlInterrupt : UserControl
    {
        private string _state = "pending";

        public HitlInterrupt()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Human-in-the-loop interrupt banner for a");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
