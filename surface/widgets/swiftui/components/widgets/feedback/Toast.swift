// ============================================================
// Clef Surface SwiftUI Widget — Toast
//
// Ephemeral notification that appears briefly to communicate
// the result of an action. Supports info, success, warning,
// and error variants with optional action button.
//
// Adapts the toast.widget spec to SwiftUI rendering.
// ============================================================

import SwiftUI

// --------------- Types ---------------

enum ToastVariant {
    case info, success, warning, error

    var iconName: String {
        switch self {
        case .info: return "info.circle.fill"
        case .success: return "checkmark.circle.fill"
        case .warning: return "exclamationmark.triangle.fill"
        case .error: return "exclamationmark.circle.fill"
        }
    }

    var containerColor: Color {
        switch self {
        case .info: return Color(red: 0.1, green: 0.46, blue: 0.82)
        case .success: return Color(red: 0.22, green: 0.56, blue: 0.24)
        case .warning: return Color(red: 0.96, green: 0.49, blue: 0)
        case .error: return Color(red: 0.83, green: 0.18, blue: 0.18)
        }
    }
}

struct ToastAction {
    let label: String
    let onAction: () -> Void
}

// --------------- Component ---------------

/// Toast view for ephemeral notification display.
///
/// - Parameters:
///   - variant: Visual variant controlling icon and color.
///   - title: Primary notification message.
///   - description: Optional secondary detail text.
///   - action: Optional action button configuration.
///   - onDismiss: Callback when the toast is dismissed.
struct ToastView: View {
    var variant: ToastVariant = .info
    var title: String = ""
    var description: String? = nil
    var action: ToastAction? = nil
    var onDismiss: (() -> Void)? = nil

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: variant.iconName)
                .foregroundColor(.white)
                .frame(width: 20, height: 20)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)

                if let description = description {
                    Text(description)
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.9))
                }
            }

            Spacer()

            if let action = action {
                SwiftUI.Button(action: action.onAction) {
                    Text(action.label)
                        .font(.caption)
                        .foregroundColor(.white)
                }
                .buttonStyle(.plain)
            }

            if let onDismiss = onDismiss {
                SwiftUI.Button(action: onDismiss) {
                    Text("\u{2715}")
                        .foregroundColor(.white)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Dismiss")
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(variant.containerColor)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .accessibilityLabel(title)
    }
}
