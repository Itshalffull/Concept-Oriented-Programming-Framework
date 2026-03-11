import SwiftUI

enum VerificationStatus: String { case proved, refuted, unknown, timeout, running }

enum VerificationBadgeWidgetState { case idle, hovered, animating }

struct VerificationStatusBadgeView: View {
    var status: VerificationStatus = .unknown
    var label: String = "Unknown"
    var duration: Int?
    var solver: String?
    var size: String = "md"

    @State private var widgetState: VerificationBadgeWidgetState = .idle
    @State private var isHovered: Bool = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var statusIcon: String {
        switch status {
        case .proved: return "\u{2713}"
        case .refuted: return "\u{2717}"
        case .unknown: return "?"
        case .timeout: return "\u{23F0}"
        case .running: return "\u{25CB}"
        }
    }

    private var statusColor: Color {
        switch status {
        case .proved: return .green
        case .refuted: return .red
        case .unknown: return .gray
        case .timeout: return .orange
        case .running: return .blue
        }
    }

    private var fontSize: CGFloat {
        switch size { case "sm": return 12; case "lg": return 18; default: return 14 }
    }

    var body: some View {
        HStack(spacing: 6) {
            Text(statusIcon).foregroundColor(statusColor)
            Text(label).font(.system(size: fontSize))
        }
        .padding(.horizontal, 8).padding(.vertical, 4)
        .background(statusColor.opacity(0.1))
        .cornerRadius(6)
        .onHover { hovering in isHovered = hovering; widgetState = hovering ? .hovered : .idle }
        .overlay(alignment: .top) {
            if isHovered, let tooltipText = tooltipContent {
                Text(tooltipText)
                    .font(.caption)
                    .padding(6)
                    .background(Color(.darkGray))
                    .foregroundColor(.white)
                    .cornerRadius(4)
                    .offset(y: -30)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Verification status: \(label)")
        .accessibilityValue([solver, duration.map { "\($0)ms" }].compactMap { $0 }.joined(separator: ", "))
    }

    private var tooltipContent: String? {
        let parts = [solver, duration.map { "\($0)ms" }].compactMap { $0 }
        return parts.isEmpty ? nil : parts.joined(separator: " \u{2014} ")
    }
}
