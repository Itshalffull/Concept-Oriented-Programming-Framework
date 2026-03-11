// ============================================================
// Clef Surface SwiftUI Widget — Splitter
//
// Resizable split-pane layout with a draggable divider between
// two content areas. Supports horizontal and vertical orientation.
// ============================================================

import SwiftUI

// --------------- Types ---------------

enum SplitterOrientation { case horizontal, vertical }

// --------------- Component ---------------

/// Splitter view with a draggable divider between two panes.
///
/// - Parameters:
///   - orientation: Split direction: horizontal or vertical.
///   - ratio: Binding to the split ratio (0.0 to 1.0).
///   - minRatio: Minimum ratio for the first pane.
///   - maxRatio: Maximum ratio for the first pane.
///   - primary: Primary (first) pane content.
///   - secondary: Secondary (second) pane content.
struct SplitterView<Primary: View, Secondary: View>: View {
    var orientation: SplitterOrientation = .horizontal
    @Binding var ratio: CGFloat
    var minRatio: CGFloat = 0.2
    var maxRatio: CGFloat = 0.8
    @ViewBuilder var primary: Primary
    @ViewBuilder var secondary: Secondary

    var body: some View {
        GeometryReader { geometry in
            if orientation == .horizontal {
                HStack(spacing: 0) {
                    primary
                        .frame(width: geometry.size.width * ratio)

                    Rectangle()
                        .fill(Color(.systemGray4))
                        .frame(width: 4)
                        .gesture(
                            DragGesture()
                                .onChanged { value in
                                    let newRatio = value.location.x / geometry.size.width
                                    ratio = Swift.min(Swift.max(newRatio, minRatio), maxRatio)
                                }
                        )
                        .onHover { hovering in
                            #if os(macOS)
                            if hovering {
                                NSCursor.resizeLeftRight.push()
                            } else {
                                NSCursor.pop()
                            }
                            #endif
                        }

                    secondary
                }
            } else {
                VStack(spacing: 0) {
                    primary
                        .frame(height: geometry.size.height * ratio)

                    Rectangle()
                        .fill(Color(.systemGray4))
                        .frame(height: 4)
                        .gesture(
                            DragGesture()
                                .onChanged { value in
                                    let newRatio = value.location.y / geometry.size.height
                                    ratio = Swift.min(Swift.max(newRatio, minRatio), maxRatio)
                                }
                        )

                    secondary
                }
            }
        }
    }
}
