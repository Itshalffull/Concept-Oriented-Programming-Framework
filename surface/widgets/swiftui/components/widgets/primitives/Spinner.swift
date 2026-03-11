// ============================================================
// Clef Surface SwiftUI Widget — Spinner
//
// Indeterminate loading indicator rendered with ProgressView.
// An optional label is displayed alongside the spinner. Size
// affects the indicator diameter.
//
// Adapts the spinner.widget spec: anatomy (root, track,
// indicator, label), states (spinning), and connect attributes
// (data-part, data-size, role, aria-busy, aria-label)
// to SwiftUI rendering.
// ============================================================

import SwiftUI

// --------------- Types ---------------

enum SpinnerSize: String {
    case sm, md, lg

    var scale: CGFloat {
        switch self {
        case .sm: return 0.6
        case .md: return 1.0
        case .lg: return 1.5
        }
    }
}

// --------------- Component ---------------

/// Spinner view that renders an indeterminate circular progress
/// indicator with an optional text label alongside.
///
/// - Parameters:
///   - size: Size of the spinner: sm, md, or lg.
///   - label: Optional text label displayed next to the spinner.
struct SpinnerView: View {
    var size: SpinnerSize = .md
    var label: String? = nil

    var body: some View {
        HStack(spacing: 8) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle())
                .scaleEffect(size.scale)

            if let label = label {
                Text(label)
                    .font(.body)
                    .foregroundColor(.primary)
            }
        }
        .accessibilityLabel(label ?? "Loading")
    }
}
