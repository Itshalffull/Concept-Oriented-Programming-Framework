// ============================================================
// Clef Surface SwiftUI Widget — RadioCard
//
// Visual single-choice selection using rich card-style options.
// Each card renders with a radio indicator, label, and optional
// description.
// ============================================================

import SwiftUI

// --------------- Types ---------------

struct RadioCardOption: Identifiable {
    let id: String
    let label: String
    let value: String
    var description: String? = nil

    init(label: String, value: String, description: String? = nil) {
        self.id = value
        self.label = label
        self.value = value
        self.description = description
    }
}

// --------------- Component ---------------

/// RadioCard view for single-choice selection with rich card options.
///
/// - Parameters:
///   - value: Binding to the selected value.
///   - options: Available radio card options.
///   - enabled: Whether the control is enabled.
struct RadioCardView: View {
    @Binding var value: String?
    var options: [RadioCardOption]
    var enabled: Bool = true

    var body: some View {
        VStack(spacing: 8) {
            ForEach(options) { option in
                let isSelected = option.value == value

                SwiftUI.Button(action: {
                    guard enabled else { return }
                    value = option.value
                }) {
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: isSelected ? "circle.inset.filled" : "circle")
                            .foregroundColor(enabled ? .accentColor : .gray)

                        VStack(alignment: .leading, spacing: 4) {
                            Text(option.label)
                                .font(.headline)
                                .foregroundColor(enabled ? .primary : .gray)

                            if let description = option.description {
                                Text(description)
                                    .font(.body)
                                    .foregroundColor(.secondary)
                            }
                        }

                        Spacer()
                    }
                    .padding(16)
                    .background(Color(.systemBackground))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(
                                isSelected ? Color.accentColor : Color(.systemGray4),
                                lineWidth: isSelected ? 2 : 1
                            )
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)
                .disabled(!enabled)
                .accessibilityAddTraits(isSelected ? .isSelected : [])
            }
        }
    }
}
