// ============================================================
// Clef Surface SwiftUI Widget — StatCard
//
// Compact metric display card showing a label, value, and
// optional trend indicator with delta.
// ============================================================

import SwiftUI

// --------------- Types ---------------

enum StatTrend { case up, down, neutral }

// --------------- Component ---------------

/// StatCard view for metric display with trend.
///
/// - Parameters:
///   - label: Metric label text.
///   - value: Primary metric value.
///   - delta: Optional change delta string.
///   - trend: Trend direction: up, down, or neutral.
///   - icon: Optional SF Symbol name.
struct StatCardView: View {
    var label: String
    var value: String
    var delta: String? = nil
    var trend: StatTrend = .neutral
    var icon: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(label)
                    .font(.caption)
                    .foregroundColor(.secondary)
                Spacer()
                if let icon = icon {
                    Image(systemName: icon)
                        .foregroundColor(.secondary)
                }
            }

            Text(value)
                .font(.title2)
                .fontWeight(.bold)

            if let delta = delta {
                HStack(spacing: 4) {
                    Image(systemName: trendIcon)
                        .font(.caption2)
                        .foregroundColor(trendColor)
                    Text(delta)
                        .font(.caption)
                        .foregroundColor(trendColor)
                }
            }
        }
        .padding(16)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color(.systemGray4), lineWidth: 1)
        )
        .accessibilityLabel("\(label): \(value)")
    }

    private var trendIcon: String {
        switch trend {
        case .up: return "arrow.up"
        case .down: return "arrow.down"
        case .neutral: return "minus"
        }
    }

    private var trendColor: Color {
        switch trend {
        case .up: return .green
        case .down: return .red
        case .neutral: return .secondary
        }
    }
}
