import SwiftUI

// State machine: idle (no hover on watch)
enum WeightBreakdownWatchState {
    case idle
}

enum WeightBreakdownWatchEvent {
    case tap(Int)
}

func weightBreakdownWatchReduce(_ state: WeightBreakdownWatchState, _ event: WeightBreakdownWatchEvent) -> WeightBreakdownWatchState {
    return .idle
}

struct WeightSourceData: Identifiable {
    let id = UUID()
    let label: String
    let type: String // "token", "delegation", "reputation", "manual"
    let value: Double
    var color: Color? = nil
}

struct WeightBreakdownWatchView: View {
    let sources: [WeightSourceData]
    let totalWeight: Double

    @State private var state: WeightBreakdownWatchState = .idle
    @State private var selectedIndex: Int? = nil

    private let defaultColors: [Color] = [.blue, .green, .orange, .purple, .cyan, .pink]

    private func sourceColor(_ index: Int) -> Color {
        sources[index].color ?? defaultColors[index % defaultColors.count]
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                Text("Weight Breakdown").font(.caption2).fontWeight(.bold)
                Text("Total: \(String(format: "%.1f", totalWeight))")
                    .font(.system(size: 9)).foregroundColor(.secondary)

                // Bar
                GeometryReader { geo in
                    HStack(spacing: 0) {
                        ForEach(Array(sources.enumerated()), id: \.element.id) { index, source in
                            let pct = totalWeight > 0 ? source.value / totalWeight : 0
                            Rectangle()
                                .fill(sourceColor(index))
                                .frame(width: max(1, geo.size.width * pct))
                        }
                    }
                }
                .frame(height: 12)
                .cornerRadius(4)

                // Legend
                ForEach(Array(sources.enumerated()), id: \.element.id) { index, source in
                    Button {
                        selectedIndex = selectedIndex == index ? nil : index
                    } label: {
                        HStack(spacing: 4) {
                            Circle().fill(sourceColor(index)).frame(width: 6, height: 6)
                            Text(source.label).font(.system(size: 9)).lineLimit(1)
                            Spacer()
                            Text(String(format: "%.1f", source.value))
                                .font(.system(size: 9)).fontWeight(.semibold)
                            let pct = totalWeight > 0 ? source.value / totalWeight * 100 : 0
                            Text("(\(String(format: "%.0f", pct))%)")
                                .font(.system(size: 7)).foregroundColor(.secondary)
                        }
                        .padding(.vertical, 1)
                        .background(selectedIndex == index ? Color.blue.opacity(0.1) : Color.clear)
                        .cornerRadius(2)
                    }
                    .buttonStyle(.plain)
                }

                if let idx = selectedIndex, idx < sources.count {
                    Divider()
                    VStack(alignment: .leading, spacing: 1) {
                        Text(sources[idx].label).font(.caption2).fontWeight(.bold)
                        Text("Type: \(sources[idx].type)").font(.system(size: 8)).foregroundColor(.secondary)
                        Text("Value: \(String(format: "%.2f", sources[idx].value))").font(.system(size: 8))
                    }
                }
            }
            .padding(.horizontal, 4)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Weight breakdown, total \(String(format: "%.1f", totalWeight))")
    }
}
