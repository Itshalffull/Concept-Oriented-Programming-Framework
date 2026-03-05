import SwiftUI

struct MessageActionsView: View {
    @State private var state = "hidden"

    var body: some View {
        VStack {
            Text("MessageActions")
                .font(.caption)
        }
        .accessibilityLabel("Hover-revealed toolbar for cha")
    }
}
