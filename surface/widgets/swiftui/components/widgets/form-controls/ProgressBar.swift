// ============================================================
// Clef Surface SwiftUI Widget — ProgressBar
//
// Visual progress indicator. Renders a ProgressView with an
// optional label and percentage readout.
// ============================================================

import SwiftUI

// --------------- Types ---------------

enum ProgressBarSize {
    case sm, md, lg

    var trackHeight: CGFloat {
        switch self {
        case .sm: return 4
        case .md: return 8
        case .lg: return 12
        }
    }
}

// --------------- Component ---------------

/// ProgressBar view with an optional label and percentage display.
///
/// - Parameters:
///   - value: Current progress value.
///   - max: Maximum value (default 100).
///   - size: Size controlling track height.
///   - label: Optional label text.
///   - showValue: Whether to show the percentage.
///   - color: Fill color for the progress track.
///   - trackColor: Background track color.
struct ProgressBarView: View {
    var value: Float
    var max: Float = 100
    var size: ProgressBarSize = .md
    var label: String? = nil
    var showValue: Bool = true
    var color: Color = .accentColor
    var trackColor: Color = Color(.systemGray5)

    private var clamped: Float { Swift.min(Swift.max(value, 0), max) }
    private var progress: Float { max > 0 ? clamped / max : 0 }
    private var percent: Int { Int(progress * 100) }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let label = label {
                Text(label)
                    .font(.headline)
            }

            HStack(spacing: 8) {
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: size.trackHeight / 2)
                            .fill(trackColor)
                            .frame(height: size.trackHeight)

                        RoundedRectangle(cornerRadius: size.trackHeight / 2)
                            .fill(color)
                            .frame(width: geometry.size.width * CGFloat(progress), height: size.trackHeight)
                    }
                }
                .frame(height: size.trackHeight)

                if showValue {
                    Text("\(percent)%")
                        .font(.caption)
                }
            }
        }
        .accessibilityValue("\(percent) percent")
    }
}
