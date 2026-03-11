// ============================================================
// Clef Surface SwiftUI Widget — ChipInput
//
// Free-form multi-value input that creates removable chips
// from typed text. Shows chip views followed by an inline
// text field. Return adds a chip, delete on empty input
// removes the last chip.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// ChipInput view for free-form multi-value entry.
///
/// - Parameters:
///   - value: Binding to the array of chip strings.
///   - placeholder: Placeholder text for the input.
///   - enabled: Whether the input is enabled.
///   - onAdd: Callback when a chip is added.
///   - onRemove: Callback when a chip is removed by index.
struct ChipInputView: View {
    @Binding var value: [String]
    var placeholder: String = "Type and press Return..."
    var enabled: Bool = true
    var onAdd: ((String) -> Void)? = nil
    var onRemove: ((Int) -> Void)? = nil

    @State private var inputText: String = ""

    var body: some View {
        FlowLayout(spacing: 8) {
            ForEach(Array(value.enumerated()), id: \.offset) { index, chip in
                HStack(spacing: 4) {
                    Text(chip)
                        .font(.subheadline)
                    SwiftUI.Button(action: {
                        guard enabled else { return }
                        value.remove(at: index)
                        onRemove?(index)
                    }) {
                        Image(systemName: "xmark")
                            .font(.caption2)
                    }
                    .buttonStyle(.plain)
                    .disabled(!enabled)
                    .accessibilityLabel("Remove \(chip)")
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(Color(.systemGray5))
                .clipShape(Capsule())
            }

            TextField(placeholder, text: $inputText)
                .textFieldStyle(.plain)
                .disabled(!enabled)
                .onSubmit {
                    let trimmed = inputText.trimmingCharacters(in: .whitespaces)
                    guard !trimmed.isEmpty, !value.contains(trimmed) else { return }
                    value.append(trimmed)
                    onAdd?(trimmed)
                    inputText = ""
                }
                .frame(minWidth: 100)
        }
    }
}

// --------------- Flow Layout ---------------

private struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = arrangeSubviews(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrangeSubviews(proposal: proposal, subviews: subviews)
        for (index, position) in result.positions.enumerated() {
            subviews[index].place(at: CGPoint(x: bounds.minX + position.x, y: bounds.minY + position.y), proposal: .unspecified)
        }
    }

    private struct ArrangeResult {
        var size: CGSize
        var positions: [CGPoint]
    }

    private func arrangeSubviews(proposal: ProposedViewSize, subviews: Subviews) -> ArrangeResult {
        let maxWidth = proposal.width ?? .infinity
        var positions: [CGPoint] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var totalHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > maxWidth && x > 0 {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            positions.append(CGPoint(x: x, y: y))
            rowHeight = max(rowHeight, size.height)
            x += size.width + spacing
            totalHeight = y + rowHeight
        }

        return ArrangeResult(size: CGSize(width: maxWidth, height: totalHeight), positions: positions)
    }
}
