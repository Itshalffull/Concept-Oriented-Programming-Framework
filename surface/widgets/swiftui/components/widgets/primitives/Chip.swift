// ============================================================
// Clef Surface SwiftUI Widget — Chip
//
// Compact interactive tag element. Supports filled and outline
// variants, selection toggle, and an optional dismiss action.
//
// Adapts the chip.widget spec: anatomy (root, label,
// deleteButton, icon), states (idle, selected, hovered, focused,
// removed, deletable, disabled), and connect attributes
// (data-part, data-state, data-disabled) to SwiftUI rendering.
// ============================================================

import SwiftUI

// --------------- Types ---------------

enum ChipVariant: String {
    case filled, outline
}

// --------------- Component ---------------

/// Chip view that renders a compact tag with optional selection
/// and dismiss behaviour.
///
/// - Parameters:
///   - label: Text content of the chip.
///   - variant: Visual variant: filled or outline.
///   - selected: Whether the chip is selected.
///   - disabled: Whether the chip is disabled.
///   - removable: Whether the chip can be removed.
///   - onSelect: Callback when the chip is selected/deselected.
///   - onRemove: Callback when the remove action is triggered.
struct ChipView: View {
    var label: String = ""
    var variant: ChipVariant = .filled
    var selected: Bool = false
    var disabled: Bool = false
    var removable: Bool = false
    var onSelect: (() -> Void)? = nil
    var onRemove: (() -> Void)? = nil

    var body: some View {
        HStack(spacing: 4) {
            Text(label)
                .font(.subheadline)
                .foregroundColor(foregroundColor)

            if removable {
                SwiftUI.Button(action: {
                    guard !disabled else { return }
                    onRemove?()
                }) {
                    Image(systemName: "xmark")
                        .font(.caption2)
                        .foregroundColor(foregroundColor)
                }
                .buttonStyle(.plain)
                .disabled(disabled)
                .accessibilityLabel("Remove \(label)")
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(backgroundColor)
        .clipShape(Capsule())
        .overlay(
            Capsule()
                .stroke(borderColor, lineWidth: variant == .outline ? 1 : 0)
        )
        .opacity(disabled ? 0.38 : 1.0)
        .onTapGesture {
            guard !disabled else { return }
            onSelect?()
        }
        .accessibilityLabel(label)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private var foregroundColor: Color {
        selected ? .white : .primary
    }

    private var backgroundColor: Color {
        if selected { return .accentColor }
        if variant == .filled { return Color(.systemGray5) }
        return .clear
    }

    private var borderColor: Color {
        variant == .outline ? Color(.systemGray3) : .clear
    }
}
