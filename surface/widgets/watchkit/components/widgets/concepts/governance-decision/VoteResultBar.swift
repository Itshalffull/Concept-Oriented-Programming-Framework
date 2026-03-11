import SwiftUI

// State machine: idle | animating (no hover on watch)
enum VoteResultBarWatchState {
    case idle
    case animating
}

enum VoteResultBarWatchEvent {
    case animateIn
    case animationEnd
}

func voteResultBarWatchReduce(_ state: VoteResultBarWatchState, _ event: VoteResultBarWatchEvent) -> VoteResultBarWatchState {
    switch state {
    case .idle:
        if case .animateIn = event { return .animating }
        return state
    case .animating:
        if case .animationEnd = event { return .idle }
        return state
    }
}

struct VoteSegment: Identifiable {
    let id = UUID()
    let label: String
    let count: Int
    var color: Color? = nil
}

struct VoteResultBarWatchView: View {
    let segments: [VoteSegment]
    var total: Int? = nil
    var showLabels: Bool = true

    @State private var state: VoteResultBarWatchState = .idle

    private let defaultColors: [Color] = [.green, .red, .orange, .blue, .purple, .cyan]

    private var computedTotal: Int {
        total ?? segments.reduce(0) { $0 + $1.count }
    }

    private func segmentColor(_ index: Int) -> Color {
        segments[index].color ?? defaultColors[index % defaultColors.count]
    }

    private func segmentPercent(_ count: Int) -> Double {
        computedTotal > 0 ? Double(count) / Double(computedTotal) * 100 : 0
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Bar
            GeometryReader { geo in
                HStack(spacing: 0) {
                    ForEach(Array(segments.enumerated()), id: \.element.id) { index, segment in
                        let pct = segmentPercent(segment.count)
                        Rectangle()
                            .fill(segmentColor(index))
                            .frame(width: max(computedTotal > 0 && segment.count == 0 ? 1 : 0, geo.size.width * pct / 100))
                    }
                }
            }
            .frame(height: 10)
            .cornerRadius(3)

            // Labels
            if showLabels {
                ForEach(Array(segments.enumerated()), id: \.element.id) { index, segment in
                    HStack(spacing: 4) {
                        Circle()
                            .fill(segmentColor(index))
                            .frame(width: 6, height: 6)
                        Text(segment.label)
                            .font(.system(size: 9))
                        Spacer()
                        Text("\(segment.count)")
                            .font(.system(size: 9))
                            .fontWeight(.semibold)
                        Text("(\(String(format: "%.0f", segmentPercent(segment.count)))%)")
                            .font(.system(size: 8))
                            .foregroundColor(.secondary)
                    }
                }
            }

            // Total
            Text("Total: \(computedTotal)")
                .font(.system(size: 8))
                .foregroundColor(.secondary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Vote results: \(segments.map { "\($0.label) \($0.count)" }.joined(separator: ", "))")
    }
}
