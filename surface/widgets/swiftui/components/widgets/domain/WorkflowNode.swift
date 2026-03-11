// ============================================================
// Clef Surface SwiftUI Widget — WorkflowNode
//
// Single node within a workflow graph rendered as a card
// with status icon, label, and input/output port indicators.
// Status is indicated by icon and color.
// ============================================================

import SwiftUI

private let statusIcons: [String: String] = [
    "idle": "\u{25CB}",
    "running": "\u{25CE}",
    "completed": "\u{25CF}",
    "error": "\u{2716}",
]

private let statusColors: [String: Color] = [
    "idle": .gray,
    "running": .yellow,
    "completed": .green,
    "error": .red,
]

struct WorkflowNodeView: View {
    var id: String
    var label: String
    var type: String
    var status: String = "idle"
    var inputs: [String] = []
    var outputs: [String] = []
    var onSelect: (String) -> Void = { _ in }

    private var statusIcon: String { statusIcons[status] ?? "\u{25CB}" }
    private var statusColor: Color { statusColors[status] ?? .gray }

    var body: some View {
        SwiftUI.Button(action: { onSelect(id) }) {
            VStack(alignment: .leading, spacing: 4) {
                // Header
                HStack(spacing: 8) {
                    Text("[\(statusIcon)]")
                        .foregroundColor(statusColor)
                        .font(.subheadline)

                    Text(label)
                        .font(.body)
                        .fontWeight(.bold)

                    Text("(\(type))")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                // Input ports
                if !inputs.isEmpty {
                    HStack(spacing: 4) {
                        Text("in:")
                            .font(.caption2)
                            .foregroundColor(.secondary)

                        ForEach(inputs, id: \.self) { port in
                            Text("\u{25C0}\(port)")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.leading, 8)
                }

                // Output ports
                if !outputs.isEmpty {
                    HStack(spacing: 4) {
                        Text("out:")
                            .font(.caption2)
                            .foregroundColor(.secondary)

                        ForEach(outputs, id: \.self) { port in
                            Text("\(port)\u{25B6}")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.leading, 8)
                }

                // Status line
                Text("Status: \(status)")
                    .font(.caption2)
                    .foregroundColor(statusColor)
                    .padding(.top, 4)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color(.systemBackground))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(statusColor, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(label), \(type), status: \(status)")
    }
}
