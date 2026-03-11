// ============================================================
// Clef Surface WatchKit Widget — SignaturePad
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct SignaturePadView: View {
    var message: String = "Signature pad not available on watchOS"
    var body: some View { VStack { Image(systemName: "pencil.tip").font(.title3).foregroundColor(.secondary); Text(message).font(.caption2).foregroundColor(.secondary) } }
}
