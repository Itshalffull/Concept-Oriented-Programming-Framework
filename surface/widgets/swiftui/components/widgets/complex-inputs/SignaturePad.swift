// ============================================================
// Clef Surface SwiftUI Widget — SignaturePad
//
// Canvas-based signature input allowing freehand drawing.
// Supports clear and undo actions.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// SignaturePad view for freehand signature capture.
///
/// - Parameters:
///   - lines: Binding to the array of drawn line paths.
///   - strokeColor: Color for the drawing stroke.
///   - lineWidth: Width of the drawing stroke.
///   - enabled: Whether the pad accepts input.
///   - onClear: Callback when the signature is cleared.
struct SignaturePadView: View {
    @Binding var lines: [[CGPoint]]
    var strokeColor: Color = .primary
    var lineWidth: CGFloat = 2
    var enabled: Bool = true
    var onClear: (() -> Void)? = nil

    @State private var currentLine: [CGPoint] = []

    var body: some View {
        VStack(spacing: 8) {
            Canvas { context, _ in
                for line in lines {
                    var path = Path()
                    guard let first = line.first else { continue }
                    path.move(to: first)
                    for point in line.dropFirst() {
                        path.addLine(to: point)
                    }
                    context.stroke(path, with: .color(strokeColor), lineWidth: lineWidth)
                }

                // Current line
                if !currentLine.isEmpty {
                    var path = Path()
                    path.move(to: currentLine[0])
                    for point in currentLine.dropFirst() {
                        path.addLine(to: point)
                    }
                    context.stroke(path, with: .color(strokeColor), lineWidth: lineWidth)
                }
            }
            .frame(height: 150)
            .background(Color(.systemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color(.systemGray4), lineWidth: 1)
            )
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        guard enabled else { return }
                        currentLine.append(value.location)
                    }
                    .onEnded { _ in
                        guard enabled else { return }
                        lines.append(currentLine)
                        currentLine = []
                    }
            )

            HStack {
                SwiftUI.Button("Clear") {
                    lines.removeAll()
                    currentLine = []
                    onClear?()
                }
                .disabled(!enabled || lines.isEmpty)

                Spacer()

                SwiftUI.Button("Undo") {
                    guard !lines.isEmpty else { return }
                    lines.removeLast()
                }
                .disabled(!enabled || lines.isEmpty)
            }
        }
        .accessibilityLabel("Signature pad")
    }
}
