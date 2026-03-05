import SwiftUI

struct VoteSegment: Identifiable {
    let id = UUID()
    let label: String; let count: Int; var color: Color?
}

enum VoteResultBarWidgetState { case idle, animating, segmentHovered }

struct VoteResultBarView: View {
    let segments: [VoteSegment]
    var total: Int?
    var variant: String = "binary"
    var showLabels: Bool = true
    var showQuorum: Bool = false
    var quorumThreshold: Double = 0
    var animate: Bool = true
    var size: String = "md"
    var onSegmentHover: ((Int?, VoteSegment?) -> Void)?

    @State private var widgetState: VoteResultBarWidgetState = .idle
    @State private var hoveredIndex: Int?

    private let defaultColors: [Color] = [.green, .red, .orange, .blue, .purple, .cyan]
    private var effectiveTotal: Int { total ?? segments.reduce(0) { $0 + $1.count } }
    private var barHeight: CGFloat { size == "sm" ? 16 : size == "lg" ? 36 : 24 }

    private func percent(_ count: Int) -> Double {
        effectiveTotal > 0 ? Double(count) / Double(effectiveTotal) * 100 : 0
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    HStack(spacing: 0) {
                        ForEach(Array(segments.enumerated()), id: \.element.id) { idx, seg in
                            let w = geo.size.width * CGFloat(percent(seg.count) / 100)
                            Rectangle()
                                .fill(seg.color ?? defaultColors[idx % defaultColors.count])
                                .frame(width: max(w, seg.count == 0 ? 2 : w))
                                .opacity(hoveredIndex != nil && hoveredIndex != idx ? 0.5 : 1)
                                .onHover { h in hoveredIndex = h ? idx : nil; onSegmentHover?(h ? idx : nil, h ? seg : nil) }
                        }
                    }
                    if showQuorum && quorumThreshold > 0 {
                        Rectangle().fill(Color.black).frame(width: 2)
                            .offset(x: geo.size.width * CGFloat(quorumThreshold / 100))
                    }
                }
            }
            .frame(height: barHeight)
            .cornerRadius(4)

            if showLabels {
                HStack(spacing: 12) {
                    ForEach(Array(segments.enumerated()), id: \.element.id) { idx, seg in
                        HStack(spacing: 4) {
                            Circle().fill(seg.color ?? defaultColors[idx % defaultColors.count]).frame(width: 8, height: 8)
                            Text("\(seg.label) \(seg.count) (\(String(format: "%.1f", percent(seg.count)))%)")
                                .font(.system(size: size == "sm" ? 11 : size == "lg" ? 14 : 12))
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }

            Text("Total: \(effectiveTotal)").font(.system(size: size == "sm" ? 11 : 12)).foregroundColor(.secondary)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Vote results, total \(effectiveTotal) votes")
    }
}
