// ============================================================
// Clef Surface WatchKit Widget — ProgressBar
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct ProgressBarView: View {
    var progress: Double = 0
    var body: some View { ProgressView(value: progress).progressViewStyle(.linear) }
}
