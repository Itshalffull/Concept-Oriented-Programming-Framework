// ============================================================
// Clef Surface SwiftUI Widget — Timeline
//
// Vertical chronological event display with connecting lines
// between event nodes. Each event has a title, description,
// and timestamp.
// ============================================================

import SwiftUI

// --------------- Types ---------------

struct TimelineEvent: Identifiable {
    let id: String
    let title: String
    var description: String? = nil
    var timestamp: String? = nil
    var icon: String = "circle.fill"
}

// --------------- Component ---------------

/// Timeline view for chronological event display.
///
/// - Parameters:
///   - events: Array of timeline events.
///   - color: Color for the timeline line and nodes.
struct TimelineView: View {
    var events: [TimelineEvent]
    var color: Color = .accentColor

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(events.enumerated()), id: \.element.id) { index, event in
                HStack(alignment: .top, spacing: 12) {
                    // Timeline node and line
                    VStack(spacing: 0) {
                        Image(systemName: event.icon)
                            .font(.caption)
                            .foregroundColor(color)
                            .frame(width: 20, height: 20)

                        if index < events.count - 1 {
                            Rectangle()
                                .fill(color.opacity(0.3))
                                .frame(width: 2)
                                .frame(maxHeight: .infinity)
                        }
                    }
                    .frame(width: 20)

                    // Event content
                    VStack(alignment: .leading, spacing: 4) {
                        Text(event.title)
                            .font(.subheadline)
                            .fontWeight(.semibold)

                        if let description = event.description {
                            Text(description)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }

                        if let timestamp = event.timestamp {
                            Text(timestamp)
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.bottom, 16)
                }
            }
        }
    }
}
