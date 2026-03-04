// ============================================================
// Clef Surface WatchKit Widget — Skeleton
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct SkeletonView: View {
    var width: CGFloat = 100; var height: CGFloat = 16
    @State private var opacity: Double = 0.3
    var body: some View { RoundedRectangle(cornerRadius: 4).fill(Color.gray.opacity(opacity)).frame(width: width, height: height).onAppear { withAnimation(.easeInOut(duration: 1).repeatForever()) { opacity = 0.7 } } }
}
