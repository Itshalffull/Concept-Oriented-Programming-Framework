// ============================================================
// Clef Surface WatchKit Widget - FileBrowser
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct FileBrowserView: View {
    var path: String = "/"; var items: [(name: String, isFolder: Bool)] = []; var onSelect: (Int) -> Void = { _ in }
    var body: some View {
        VStack(alignment: .leading) { Text(path).font(.caption2).foregroundColor(.secondary)
            List { ForEach(0..<items.count, id: \.self) { i in Button(action: { onSelect(i) }) {
                Label(items[i].name, systemImage: items[i].isFolder ? "folder.fill" : "doc.fill").font(.caption2)
            } } }
        }
    }
}
