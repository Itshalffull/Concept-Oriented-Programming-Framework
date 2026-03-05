import SwiftUI

// State machine: idle | animating (no hover on watch)
enum VerificationStatusBadgeWatchState {
    case idle
    case animating
}

enum VerificationStatusBadgeWatchEvent {
    case statusChange
    case animationEnd
}

func verificationStatusBadgeWatchReduce(_ state: VerificationStatusBadgeWatchState, _ event: VerificationStatusBadgeWatchEvent) -> VerificationStatusBadgeWatchState {
    switch state {
    case .idle:
        if case .statusChange = event { return .animating }
        return state
    case .animating:
        if case .animationEnd = event { return .idle }
        return state
    }
}

struct VerificationStatusBadgeWatchView: View {
    var status: String = "unknown" // "proved", "refuted", "unknown", "timeout", "running"
    var label: String = "Unknown"
    var duration: Int? = nil // milliseconds
    var solver: String? = nil

    @State private var state: VerificationStatusBadgeWatchState = .idle

    private var statusIcon: String {
        switch status {
        case "proved": return "checkmark.circle.fill"
        case "refuted": return "xmark.circle.fill"
        case "unknown": return "questionmark.circle"
        case "timeout": return "clock.badge.exclamationmark"
        case "running": return "arrow.triangle.2.circlepath"
        default: return "circle"
        }
    }

    private var statusColor: Color {
        switch status {
        case "proved": return .green
        case "refuted": return .red
        case "unknown": return .secondary
        case "timeout": return .orange
        case "running": return .blue
        default: return .primary
        }
    }

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: statusIcon)
                .font(.caption)
                .foregroundColor(statusColor)

            VStack(alignment: .leading, spacing: 1) {
                Text(label)
                    .font(.caption2)
                    .fontWeight(.semibold)

                HStack(spacing: 4) {
                    if let solver = solver {
                        Text(solver)
                            .font(.system(size: 8))
                            .foregroundColor(.secondary)
                    }
                    if let duration = duration {
                        Text("\(duration)ms")
                            .font(.system(size: 8))
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Verification status: \(label)")
        .accessibilityValue(
            [solver, duration.map { "\($0)ms" }]
                .compactMap { $0 }
                .joined(separator: ", ")
        )
    }
}
