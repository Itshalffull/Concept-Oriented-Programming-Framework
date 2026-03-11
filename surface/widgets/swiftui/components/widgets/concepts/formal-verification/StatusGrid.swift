import SwiftUI

enum CellStatus: String, CaseIterable {
    case passed, failed, running, pending, timeout
    var color: Color {
        switch self {
        case .passed: return .green; case .failed: return .red; case .running: return .blue
        case .pending: return .gray; case .timeout: return .orange
        }
    }
}

struct StatusGridItem: Identifiable {
    let id: String; let name: String; let status: CellStatus; var duration: Int?
}

struct StatusGridView: View {
    let items: [StatusGridItem]
    var columns: Int = 4
    var showAggregates: Bool = true
    var variant: String = "expanded"
    var onCellSelect: ((StatusGridItem) -> Void)?

    @State private var filter: String = "all"
    @State private var selectedIndex: Int?

    private var isCompact: Bool { variant == "compact" }
    private var filteredItems: [StatusGridItem] {
        if filter == "all" { return items }
        return items.filter { $0.status.rawValue == filter }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if showAggregates {
                let counts = Dictionary(grouping: items, by: \.status).mapValues(\.count)
                Text(CellStatus.allCases.compactMap { s in counts[s].map { "\($0) \(s.rawValue)" } }.joined(separator: ", "))
                    .font(isCompact ? .caption : .subheadline)
            }
            HStack(spacing: 4) {
                ForEach(["all", "passed", "failed"], id: \.self) { v in
                    Button(v.capitalized) { filter = v; selectedIndex = nil }
                        .buttonStyle(.bordered).controlSize(.small)
                        .tint(filter == v ? .indigo : .gray)
                }
            }
            let cols = Array(repeating: GridItem(.flexible(), spacing: isCompact ? 2 : 4), count: min(columns, max(1, filteredItems.count)))
            LazyVGrid(columns: cols, spacing: isCompact ? 2 : 4) {
                ForEach(Array(filteredItems.enumerated()), id: \.element.id) { idx, item in
                    VStack(spacing: isCompact ? 2 : 4) {
                        Circle().fill(item.status.color).frame(width: isCompact ? 10 : 14, height: isCompact ? 10 : 14)
                        Text(item.name).font(.system(size: isCompact ? 10 : 12)).lineLimit(1)
                        if !isCompact, let d = item.duration { Text(d < 1000 ? "\(d)ms" : String(format: "%.1fs", Double(d)/1000)).font(.system(size: 11)).foregroundColor(.secondary) }
                    }
                    .padding(isCompact ? 4 : 8)
                    .background(selectedIndex == idx ? Color.accentColor.opacity(0.1) : Color.clear)
                    .overlay(RoundedRectangle(cornerRadius: 4).stroke(selectedIndex == idx ? Color.indigo : Color.clear, lineWidth: 2))
                    .cornerRadius(4).contentShape(Rectangle())
                    .onTapGesture { selectedIndex = idx; onCellSelect?(item) }
                    .accessibilityLabel("\(item.name): \(item.status.rawValue)")
                }
            }
            if let idx = selectedIndex, idx < filteredItems.count {
                let item = filteredItems[idx]
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.name).fontWeight(.semibold)
                    HStack { Circle().fill(item.status.color).frame(width: 10, height: 10); Text("Status: \(item.status.rawValue.capitalized)") }
                    if let d = item.duration { Text("Duration: \(d < 1000 ? "\(d)ms" : String(format: "%.1fs", Double(d)/1000))").foregroundColor(.secondary) }
                }.font(.system(size: 13)).padding(12).overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.gray.opacity(0.3)))
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Verification status matrix")
    }
}
