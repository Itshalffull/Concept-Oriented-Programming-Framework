// ============================================================
// Clef Surface SwiftUI Widget — DataList
//
// Vertical list of labeled key-value pairs for displaying
// structured data. Each row shows a label and value.
// ============================================================

import SwiftUI

// --------------- Types ---------------

struct DataListEntry: Identifiable {
    let id = UUID()
    let label: String
    let value: String
}

// --------------- Component ---------------

/// DataList view for displaying key-value pairs.
///
/// - Parameters:
///   - entries: Array of label-value pairs.
///   - title: Optional title for the data list.
struct DataListView: View {
    var entries: [DataListEntry]
    var title: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let title = title {
                Text(title)
                    .font(.headline)
                    .fontWeight(.bold)
                    .padding(.bottom, 8)
            }

            ForEach(Array(entries.enumerated()), id: \.element.id) { index, entry in
                HStack {
                    Text(entry.label)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    Text(entry.value)
                        .font(.body)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }
                .padding(.vertical, 8)

                if index < entries.count - 1 {
                    Divider()
                }
            }
        }
    }
}
