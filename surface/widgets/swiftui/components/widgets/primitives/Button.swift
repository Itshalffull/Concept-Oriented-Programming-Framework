// ============================================================
// Clef Surface SwiftUI Widget — Button
//
// Generic action trigger supporting filled, outline, text, and
// danger variants with disabled and loading states. A spinning
// indicator replaces the icon slot when loading.
//
// Adapts the button.widget spec: anatomy (root, label, icon,
// spinner), states (idle, hovered, focused, pressed, disabled,
// loading), and connect attributes (data-variant, data-size,
// data-state, role) to SwiftUI rendering.
// ============================================================

import SwiftUI

// --------------- Types ---------------

enum ClefButtonVariant: String {
    case filled, outline, text, danger
}

enum ClefButtonSize: String {
    case sm, md, lg

    var horizontalPadding: CGFloat {
        switch self {
        case .sm: return 8
        case .md: return 16
        case .lg: return 24
        }
    }

    var verticalPadding: CGFloat {
        switch self {
        case .sm: return 4
        case .md: return 8
        case .lg: return 12
        }
    }
}

// --------------- Component ---------------

/// Button view that renders an action trigger with multiple
/// visual variants and a loading state.
///
/// - Parameters:
///   - label: Text content of the button.
///   - variant: Visual variant: filled, outline, text, or danger.
///   - size: Size controlling padding: sm, md, or lg.
///   - disabled: Whether the button is disabled.
///   - loading: Whether the button shows a loading spinner.
///   - action: Callback when the button is pressed.
struct ClefButtonView: View {
    var label: String = ""
    var variant: ClefButtonVariant = .filled
    var size: ClefButtonSize = .md
    var disabled: Bool = false
    var loading: Bool = false
    var action: (() -> Void)? = nil

    private var isEnabled: Bool { !disabled && !loading }

    var body: some View {
        SwiftUI.Button(action: { action?() }) {
            HStack(spacing: 8) {
                if loading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle())
                        .scaleEffect(0.7)
                }
                Text(label)
            }
            .padding(.horizontal, size.horizontalPadding)
            .padding(.vertical, size.verticalPadding)
        }
        .disabled(!isEnabled)
        .buttonStyle(ClefButtonStyle(variant: variant, isEnabled: isEnabled))
        .accessibilityLabel(label)
        .accessibilityAddTraits(.isButton)
    }
}

// --------------- Style ---------------

private struct ClefButtonStyle: SwiftUI.ButtonStyle {
    let variant: ClefButtonVariant
    let isEnabled: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundColor(foregroundColor)
            .background(backgroundColor(isPressed: configuration.isPressed))
            .cornerRadius(8)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(borderColor, lineWidth: variant == .outline ? 1 : 0)
            )
            .opacity(isEnabled ? 1.0 : 0.38)
    }

    private var foregroundColor: Color {
        switch variant {
        case .filled: return .white
        case .outline: return .accentColor
        case .text: return .accentColor
        case .danger: return .white
        }
    }

    private func backgroundColor(isPressed: Bool) -> Color {
        let pressedAlpha: Double = isPressed ? 0.8 : 1.0
        switch variant {
        case .filled: return Color.accentColor.opacity(pressedAlpha)
        case .outline: return Color.clear
        case .text: return Color.clear
        case .danger: return Color.red.opacity(pressedAlpha)
        }
    }

    private var borderColor: Color {
        switch variant {
        case .outline: return .accentColor
        default: return .clear
        }
    }
}
