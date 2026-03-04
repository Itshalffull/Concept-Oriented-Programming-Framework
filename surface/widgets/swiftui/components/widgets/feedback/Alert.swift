// ============================================================
// Clef Surface SwiftUI Widget — Alert
//
// Inline, persistent status message that communicates important
// information within the layout. Supports info, warning, error,
// and success variants with optional close button.
//
// Adapts the alert.widget spec to SwiftUI rendering.
// ============================================================

import SwiftUI

// --------------- Types ---------------

enum AlertVariant {
    case info, warning, error, success

    var iconName: String {
        switch self {
        case .info: return "info.circle.fill"
        case .warning: return "exclamationmark.triangle.fill"
        case .error: return "exclamationmark.circle.fill"
        case .success: return "checkmark.circle.fill"
        }
    }

    var tintColor: Color {
        switch self {
        case .info: return Color(red: 0.1, green: 0.46, blue: 0.82)
        case .warning: return Color(red: 0.96, green: 0.49, blue: 0)
        case .error: return Color(red: 0.83, green: 0.18, blue: 0.18)
        case .success: return Color(red: 0.22, green: 0.56, blue: 0.24)
        }
    }

    var containerColor: Color {
        switch self {
        case .info: return Color(red: 0.89, green: 0.95, blue: 0.99)
        case .warning: return Color(red: 1.0, green: 0.95, blue: 0.88)
        case .error: return Color(red: 1.0, green: 0.92, blue: 0.93)
        case .success: return Color(red: 0.91, green: 0.96, blue: 0.91)
        }
    }
}

// --------------- Component ---------------

/// Alert view for inline, persistent status messages.
///
/// - Parameters:
///   - variant: Visual variant controlling icon, colors, and semantics.
///   - title: Primary alert message.
///   - description: Optional secondary detail text.
///   - closable: Whether the alert can be dismissed.
///   - onClose: Callback fired when the alert is dismissed.
///   - content: Additional content rendered inside the alert body.
struct AlertView<Content: View>: View {
    var variant: AlertVariant = .info
    var title: String? = nil
    var description: String? = nil
    var closable: Bool = false
    var onClose: (() -> Void)? = nil
    @ViewBuilder var content: Content

    @State private var dismissed = false

    var body: some View {
        if !dismissed {
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .center, spacing: 12) {
                    Image(systemName: variant.iconName)
                        .foregroundColor(variant.tintColor)
                        .frame(width: 20, height: 20)

                    if let title = title {
                        Text(title)
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundColor(variant.tintColor)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    } else {
                        Spacer()
                    }

                    if closable {
                        SwiftUI.Button(action: {
                            dismissed = true
                            onClose?()
                        }) {
                            Image(systemName: "xmark")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Dismiss")
                    }
                }

                if let description = description {
                    Text(description)
                        .font(.caption)
                        .foregroundColor(.primary)
                        .padding(.leading, 32)
                }

                content
                    .padding(.leading, 32)
            }
            .padding(16)
            .background(variant.containerColor)
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }
}

extension AlertView where Content == EmptyView {
    init(
        variant: AlertVariant = .info,
        title: String? = nil,
        description: String? = nil,
        closable: Bool = false,
        onClose: (() -> Void)? = nil
    ) {
        self.variant = variant
        self.title = title
        self.description = description
        self.closable = closable
        self.onClose = onClose
        self.content = { EmptyView() }
    }
}
