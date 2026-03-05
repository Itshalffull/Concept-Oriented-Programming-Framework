import SwiftUI

struct RunListTableView: View {
    var runs: [Any]

    enum WidgetState { 
        case idle
        case rowSelected
     }
    @State private var state: WidgetState = .idle

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            VStack { /* filterBar: Status filter chips and search */ }
            VStack { /* table: Data table with sortable columns */ }
            VStack { /* headerRow: Column headers */ }
            VStack { /* dataRow: Single run row */ }
            VStack { /* statusCell: Status badge cell */ }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Table listing process runs with columns ")
    }
}
