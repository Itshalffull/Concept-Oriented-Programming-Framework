import SwiftUI

// MARK: - Types

enum WeightSourceType: String, CaseIterable { case token, delegation, reputation, manual }

struct WeightSource: Identifiable {
    let id = UUID()
    let label: String
    let weight: Double
    let type: WeightSourceType
}

// MARK: - State Machine

enum WeightBreakdownState { case idle, segmentHovered }
enum WeightBreakdownEvent {
    case hoverSegment(source: String)
    case leave
}

func weightBreakdownReduce(state: WeightBreakdownState, event: WeightBreakdownEvent) -> WeightBreakdownState {
    switch state {
    case .idle:
        if case .hoverSegment = event { return .segmentHovered }
        return state
    case .segmentHovered:
        if case .leave = event { return .idle }
        return state
    }
}

private func srcColor(_ type: WeightSourceType) -> Color {
    switch type {
    case .token: return .blue
    case .delegation: return .purple
    case .reputation: return .green
    case .manual: return .orange
    }
}

private func fmtWt(_ v: Double) -> String {
    v == v.rounded() ? String(Int(v)) : String(format: "%.2f", v)
}

// MARK: - View

struct WeightBreakdownView: View {
    let sources: [WeightSource]
    let totalWeight: Double
    let participant: String
    var variant: String = "bar"
    var showLegend: Bool = true
    var showTotal: Bool = true

    @State private var widgetState: WeightBreakdownState = .idle
    @State private var hoveredSource: String? = nil

    private var segments: [(source: WeightSource, percent: Double)] {
        sources.sorted { $0.weight > $1.weight }.map { s in
            (s, totalWeight > 0 ? (s.weight / totalWeight) * 100 : 0)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if showTotal {
                Text(fmtWt(totalWeight)).font(.title2).fontWeight(.bold)
                    .accessibilityLabel("Total weight: \(fmtWt(totalWeight))")
            }

            GeometryReader { geo in
                HStack(spacing: 0) {
                    ForEach(segments, id: \.source.id) { seg in
                        Rectangle().fill(srcColor(seg.source.type))
                            .opacity(hoveredSource != nil && hoveredSource != seg.source.label ? 0.5 : 1)
                            .frame(width: geo.size.width * CGFloat(seg.percent / 100))
                            .onHover { h in
                                if h {
                                    hoveredSource = seg.source.label
                                    widgetState = weightBreakdownReduce(state: widgetState, event: .hoverSegment(source: seg.source.label))
                                } else {
                                    hoveredSource = nil
                                    widgetState = weightBreakdownReduce(state: widgetState, event: .leave)
                                }
                            }
                            .accessibilityLabel("\(seg.source.label): \(fmtWt(seg.source.weight)) (\(fmtWt(seg.percent))%)")
                    }
                }
            }.frame(height: 24).cornerRadius(4)

            if widgetState == .segmentHovered, let h = hoveredSource,
               let seg = segments.first(where: { $0.source.label == h }) {
                HStack(spacing: 8) {
                    Circle().fill(srcColor(seg.source.type)).frame(width: 10, height: 10)
                    Text(seg.source.label).fontWeight(.medium)
                    Text(fmtWt(seg.source.weight))
                    Text("(\(fmtWt(seg.percent))%)").foregroundColor(.secondary)
                }.font(.system(size: 12)).padding(6).background(Color(.darkGray)).foregroundColor(.white).cornerRadius(4)
            }

            if showLegend {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(segments, id: \.source.id) { seg in
                        HStack(spacing: 6) {
                            RoundedRectangle(cornerRadius: 2).fill(srcColor(seg.source.type)).frame(width: 12, height: 12)
                            Text(seg.source.label).font(.system(size: 12))
                            Text("\(fmtWt(seg.percent))%").font(.system(size: 12)).foregroundColor(.secondary)
                            Text("(\(fmtWt(seg.source.weight)))").font(.system(size: 12)).foregroundColor(.secondary)
                        }
                    }
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Weight breakdown for \(participant): \(fmtWt(totalWeight)) total")
    }
}
