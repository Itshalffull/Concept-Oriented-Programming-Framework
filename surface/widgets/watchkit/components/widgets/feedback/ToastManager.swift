// ============================================================
// Clef Surface WatchKit Widget — ToastManager
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct ToastManagerView: View {
    var toasts: [(message: String, variant: String)]
    var body: some View {
        VStack(spacing: 4) { ForEach(0..<toasts.count, id: \.self) { i in ToastView(message: toasts[i].message, variant: toasts[i].variant) } }
    }
}
