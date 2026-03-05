import SwiftUI

enum GuardStatus: String { case passing, failing, pending, bypassed }

struct Guard: Identifiable {
    var id: String { guardId ?? name }
    var guardId: String?; let name: String; let description: String; let status: GuardStatus; var lastChecked: String?
    var statusIcon: String {
        switch status { case .passing: return "\u{2713}"; case .failing: return "\u{2717}"; case .pending: return "\u{23F3}"; case .bypassed: return "\u{2298}" }
    }
}

enum GuardStatusPanelWidgetState { case idle, guardSelected }

struct GuardStatusPanelView: View {
    let guards: [Guard]
    let executionStatus: String
    var showConditions: Bool = true
    var onGuardSelect: ((Guard) -> Void)?

    @State private var widgetState: GuardStatusPanelWidgetState = .idle
    @State private var selectedGuardId: String?

    private var passingCount: Int { guards.filter { $0.status == .passing }.count }
    private var hasBlockingGuards: Bool { guards.contains { $0.status == .failing } }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Pre-execution Guards").font(.headline)
                Spacer()
                Text("\(passingCount) of \(guards.count) guards passing").font(.subheadline).foregroundColor(.secondary)
            }

            if hasBlockingGuards {
                Text("Execution is blocked by failing guards")
                    .foregroundColor(.red).font(.subheadline).padding(8)
                    .background(Color.red.opacity(0.1)).cornerRadius(6)
            }

            ForEach(guards) { guard_ in
                let isSelected = widgetState == .guardSelected && selectedGuardId == guard_.id
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(guard_.statusIcon)
                        Text(guard_.name).fontWeight(.medium)
                        Spacer()
                        Text(guard_.status.rawValue.capitalized).font(.caption)
                            .foregroundColor(guard_.status == .passing ? .green : guard_.status == .failing ? .red : .secondary)
                    }
                    if showConditions { Text(guard_.description).font(.caption).foregroundColor(.secondary) }
                    if isSelected {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(guard_.description).font(.caption)
                            if let lc = guard_.lastChecked { Text("Last checked: \(lc)").font(.caption2).foregroundColor(.secondary) }
                        }.padding(6).background(Color.gray.opacity(0.05)).cornerRadius(4)
                    }
                }
                .padding(8)
                .background(isSelected ? Color.accentColor.opacity(0.08) : Color.clear)
                .cornerRadius(6)
                .contentShape(Rectangle())
                .onTapGesture {
                    if isSelected { selectedGuardId = nil; widgetState = .idle }
                    else { selectedGuardId = guard_.id; widgetState = .guardSelected; onGuardSelect?(guard_) }
                }
                .accessibilityLabel("\(guard_.name), \(guard_.status.rawValue)")
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Pre-execution guards")
    }
}
