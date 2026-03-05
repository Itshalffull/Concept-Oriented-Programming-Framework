import SwiftUI

struct VariableInspectorView: View {
    var variables: [Any]
    var runStatus: String

    enum WidgetState { 
        case idle
        case filtering
        case varSelected
     }
    @State private var state: WidgetState = .idle

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            VStack { /* searchBar: Filter variables by name */ }
            VStack { /* variableList: Scrollable list of variables */ }
            VStack { /* variableItem: Single variable row */ }
            Text("Variable name")
                .font(.body)
            Text("Variable type badge")
                .font(.body)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Key-value inspector panel for process ru")
    }
}
