// ============================================================
// Clef Surface SwiftUI Widget — BacklinkPanel
//
// Panel showing incoming references (backlinks) to the current
// document or entity. Displays a list of referencing items.
// ============================================================

import SwiftUI

struct BacklinkItem: Identifiable {
    let id: String
    let title: String
    var source: String? = nil
    var snippet: String? = nil
}

struct BacklinkPanelView: View {
    var title: String = "Backlinks"
    var items: [BacklinkItem]
    var onSelect: ((BacklinkItem) -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.headline).fontWeight(.semibold)
                Spacer()
                Text("\(items.count)")
                    .font(.caption).foregroundColor(.secondary)
                    .padding(.horizontal, 8).padding(.vertical, 2)
                    .background(Color(.systemGray5)).clipShape(Capsule())
            }
            Divider()
            if items.isEmpty {
                Text("No backlinks found").font(.body).foregroundColor(.secondary).padding(.vertical, 8)
            } else {
                ForEach(items) { item in
                    SwiftUI.Button(action: { onSelect?(item) }) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.title).font(.subheadline).fontWeight(.medium).foregroundColor(.primary)
                            if let source = item.source {
                                Text(source).font(.caption).foregroundColor(.secondary)
                            }
                            if let snippet = item.snippet {
                                Text(snippet).font(.caption).foregroundColor(.secondary).lineLimit(2)
                            }
                        }
                        .padding(.vertical, 4)
                    }.buttonStyle(.plain)
                }
            }
        }.padding(12)
    }
}
