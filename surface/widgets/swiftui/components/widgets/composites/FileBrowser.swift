// ============================================================
// Clef Surface SwiftUI Widget — FileBrowser
//
// File system browser with tree navigation, file list, and
// breadcrumb path display.
// ============================================================

import SwiftUI

struct FileItem: Identifiable {
    let id: String
    let name: String
    var isFolder: Bool = false
    var size: String? = nil
    var children: [FileItem] = []
}

struct FileBrowserView: View {
    var items: [FileItem]
    var path: [String] = []
    var onSelect: ((FileItem) -> Void)? = nil
    var onNavigate: (([String]) -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Breadcrumb path
            if !path.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 4) {
                        ForEach(Array(path.enumerated()), id: \.offset) { index, segment in
                            if index > 0 { Text("/").foregroundColor(.secondary) }
                            SwiftUI.Button(action: {
                                onNavigate?(Array(path.prefix(index + 1)))
                            }) {
                                Text(segment).font(.caption).foregroundColor(.accentColor)
                            }.buttonStyle(.plain)
                        }
                    }
                }
            }
            Divider()
            ForEach(items) { item in
                SwiftUI.Button(action: { onSelect?(item) }) {
                    HStack(spacing: 8) {
                        Image(systemName: item.isFolder ? "folder.fill" : "doc.fill")
                            .foregroundColor(item.isFolder ? .yellow : .accentColor)
                        Text(item.name).font(.body).foregroundColor(.primary)
                        Spacer()
                        if let size = item.size {
                            Text(size).font(.caption).foregroundColor(.secondary)
                        }
                        if item.isFolder {
                            Image(systemName: "chevron.right").font(.caption).foregroundColor(.secondary)
                        }
                    }.padding(.vertical, 4)
                }.buttonStyle(.plain)
            }
            if items.isEmpty {
                Text("Empty folder").font(.body).foregroundColor(.secondary).padding(.vertical, 8)
            }
        }.padding(12)
    }
}
