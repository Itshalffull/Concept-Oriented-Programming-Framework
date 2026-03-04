// ============================================================
// Clef Surface WatchKit Widget — FileUpload
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct FileUploadView: View {
    var message: String = "File upload not available on watchOS"
    var body: some View { VStack { Image(systemName: "doc.badge.plus").font(.title3).foregroundColor(.secondary); Text(message).font(.caption2).foregroundColor(.secondary) } }
}
