// ============================================================
// Clef Surface SwiftUI Widget — RadioGroup
//
// Single-choice selection from a visible list of radio options.
// All options render simultaneously with radio button indicators.
// ============================================================

import SwiftUI

// --------------- Types ---------------

struct RadioGroupOption: Identifiable {
    let id: String
    let label: String
    let value: String
    var disabled: Bool = false

    init(label: String, value: String, disabled: Bool = false) {
        self.id = value
        self.label = label
        self.value = value
        self.disabled = disabled
    }
}

enum RadioGroupOrientation { case horizontal, vertical }

// --------------- Component ---------------

/// RadioGroup view for single-choice selection.
///
/// - Parameters:
///   - value: Binding to the selected value.
///   - options: Available radio options.
///   - label: Optional group label.
///   - orientation: Layout orientation.
///   - enabled: Whether the group is enabled.
struct RadioGroupView: View {
    @Binding var value: String?
    var options: [RadioGroupOption]
    var label: String? = nil
    var orientation: RadioGroupOrientation = .vertical
    var enabled: Bool = true

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let label = label {
                Text(label)
                    .font(.headline)
            }

            let content = ForEach(options) { option in
                let isSelected = option.value == value
                let isEnabled = enabled && !option.disabled

                SwiftUI.Button(action: {
                    guard isEnabled else { return }
                    value = option.value
                }) {
                    HStack(spacing: 8) {
                        Image(systemName: isSelected ? "circle.inset.filled" : "circle")
                            .foregroundColor(isEnabled ? .accentColor : .gray)
                        Text(option.label)
                            .foregroundColor(isEnabled ? .primary : .gray)
                            .font(.body)
                    }
                }
                .buttonStyle(.plain)
                .disabled(!isEnabled)
                .accessibilityAddTraits(isSelected ? .isSelected : [])
            }

            if orientation == .horizontal {
                HStack(spacing: 16) { content }
            } else {
                VStack(alignment: .leading, spacing: 8) { content }
            }
        }
        .accessibilityElement(children: .contain)
    }
}
