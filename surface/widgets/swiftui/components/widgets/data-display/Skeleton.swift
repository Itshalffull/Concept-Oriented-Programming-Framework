// ============================================================
// Clef Surface SwiftUI Widget — Skeleton
//
// Loading placeholder displaying a pulsing animation in the
// shape of the content that will eventually load.
// ============================================================

import SwiftUI

// --------------- Types ---------------

enum SkeletonVariant { case text, circular, rectangular }

// --------------- Component ---------------

/// Skeleton view for loading placeholder display.
///
/// - Parameters:
///   - variant: Shape variant: text, circular, or rectangular.
///   - width: Width of the skeleton.
///   - height: Height of the skeleton.
///   - lines: Number of text lines (for text variant).
struct SkeletonView: View {
    var variant: SkeletonVariant = .rectangular
    var width: CGFloat? = nil
    var height: CGFloat = 20
    var lines: Int = 1

    @State private var isAnimating = false

    var body: some View {
        switch variant {
        case .text:
            VStack(alignment: .leading, spacing: 8) {
                ForEach(0..<lines, id: \.self) { index in
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color(.systemGray5))
                        .frame(
                            width: index == lines - 1 ? (width ?? .infinity) * 0.7 : width,
                            height: height
                        )
                        .frame(maxWidth: width ?? .infinity)
                        .opacity(isAnimating ? 0.5 : 1.0)
                }
            }
            .onAppear { withAnimation(.easeInOut(duration: 1.0).repeatForever()) { isAnimating = true } }

        case .circular:
            Circle()
                .fill(Color(.systemGray5))
                .frame(width: width ?? height, height: width ?? height)
                .opacity(isAnimating ? 0.5 : 1.0)
                .onAppear { withAnimation(.easeInOut(duration: 1.0).repeatForever()) { isAnimating = true } }

        case .rectangular:
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(.systemGray5))
                .frame(width: width, height: height)
                .frame(maxWidth: width ?? .infinity)
                .opacity(isAnimating ? 0.5 : 1.0)
                .onAppear { withAnimation(.easeInOut(duration: 1.0).repeatForever()) { isAnimating = true } }
        }
    }
}
