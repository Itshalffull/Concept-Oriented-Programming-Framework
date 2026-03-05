import SwiftUI

enum ProposalCardWidgetState { case idle, hovered, focused, navigating }

struct ProposalCardView: View {
    let title: String
    let description: String
    let author: String
    let status: String
    let timestamp: String
    var variant: String = "full"
    var showVoteBar: Bool = true
    var showQuorum: Bool = false
    var truncateDescription: Int = 120
    var onClick: (() -> Void)?
    var onNavigate: (() -> Void)?

    @State private var widgetState: ProposalCardWidgetState = .idle
    @State private var isHovered: Bool = false

    private var truncatedDesc: String {
        description.count <= truncateDescription ? description : String(description.prefix(truncateDescription)) + "\u{2026}"
    }

    private var actionLabel: String {
        switch status {
        case "Active": return "Vote"
        case "Passed", "Approved": return "Execute"
        case "Draft": return "Edit"
        default: return "View"
        }
    }

    private var isMinimal: Bool { variant == "minimal" }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(status).font(.caption).fontWeight(.semibold).padding(.horizontal, 8).padding(.vertical, 2)
                .background(Color.accentColor.opacity(0.15)).cornerRadius(4)
                .accessibilityLabel("Status: \(status)")
            Text(title).font(.headline)
            if !isMinimal { Text(truncatedDesc).font(.subheadline).foregroundColor(.secondary) }
            if !isMinimal {
                HStack { Circle().fill(Color.gray.opacity(0.3)).frame(width: 24, height: 24); Text(author).font(.caption) }
                    .accessibilityLabel("Proposed by \(author)")
            }
            if showVoteBar && status == "Active" && !isMinimal {
                RoundedRectangle(cornerRadius: 4).fill(Color.gray.opacity(0.1)).frame(height: 24)
            }
            Text(timestamp).font(.caption).foregroundColor(.secondary)
            if !isMinimal {
                Button(actionLabel) { onClick?(); onNavigate?() }
                    .buttonStyle(.bordered).accessibilityLabel("View proposal: \(title)")
            }
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 8).stroke(Color.gray.opacity(0.2)))
        .contentShape(Rectangle())
        .onTapGesture { onClick?(); onNavigate?() }
        .onHover { isHovered = $0 }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(status) proposal: \(title)")
    }
}
