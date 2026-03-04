// ============================================================
// Clef Surface WatchKit Widget - ImageGallery
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct ImageGalleryView: View {
    var images: [String] = []; var selectedIndex: Int = 0
    var body: some View {
        VStack {
            if images.isEmpty { Text("No images").font(.caption2).foregroundColor(.secondary) }
            else {
                TabView { ForEach(0..<images.count, id: \.self) { i in
                    Image(systemName: "photo").font(.title).foregroundColor(.secondary)
                } }.tabViewStyle(.page).frame(height: 80)
                Text("\(selectedIndex + 1)/\(images.count)").font(.caption2)
            }
        }
    }
}
