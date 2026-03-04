// ============================================================
// Clef Surface SwiftUI Widget — Minimap
//
// Scaled-down overview of a larger document or canvas, rendered
// as a small Canvas. Uses density shading to represent content
// and highlights the current viewport position within the full
// document.
// ============================================================

import SwiftUI

private func computeDensity(_ line: String) -> CGFloat {
    let trimmed = line.trimmingCharacters(in: .whitespaces)
    guard !trimmed.isEmpty else { return 0 }
    return min(CGFloat(trimmed.count) / max(CGFloat(line.count), 1), 1)
}

struct MinimapView: View {
    var content: [String]
    var visibleStart: Int
    var visibleEnd: Int
    var totalLines: Int
    var minimapWidth: CGFloat = 80
    var minimapHeight: CGFloat = 120

    var body: some View {
        let densities: [CGFloat] = {
            guard totalLines > 0 else { return [] }
            let rowCount = 60
            let linesPerRow = max(CGFloat(totalLines) / CGFloat(rowCount), 1)
            return (0..<rowCount).map { row in
                let sampleLine = min(Int(CGFloat(row) * linesPerRow), max(content.count - 1, 0))
                return computeDensity(sampleLine < content.count ? content[sampleLine] : "")
            }
        }()

        VStack(spacing: 4) {
            Canvas { context, size in
                guard !densities.isEmpty, totalLines > 0 else { return }

                let rowHeight = size.height / CGFloat(densities.count)

                // Draw density bars
                for (index, density) in densities.enumerated() {
                    if density > 0 {
                        let barWidth = size.width * density
                        let rect = CGRect(x: 0, y: CGFloat(index) * rowHeight, width: barWidth, height: rowHeight)
                        context.fill(
                            Rectangle().path(in: rect),
                            with: .color(Color.gray.opacity(0.2 + Double(density) * 0.4))
                        )
                    }
                }

                // Draw viewport indicator
                let viewTopRatio = CGFloat(visibleStart) / CGFloat(totalLines)
                let viewBottomRatio = CGFloat(visibleEnd) / CGFloat(totalLines)
                let viewTop = viewTopRatio * size.height
                let viewHeight = (viewBottomRatio - viewTopRatio) * size.height
                let viewRect = CGRect(x: 0, y: viewTop, width: size.width, height: viewHeight)

                context.fill(
                    Rectangle().path(in: viewRect),
                    with: .color(Color.purple.opacity(0.3))
                )
                context.stroke(
                    Rectangle().path(in: viewRect),
                    with: .color(.purple),
                    style: StrokeStyle(lineWidth: 2)
                )
            }
            .frame(width: minimapWidth, height: minimapHeight)
            .border(Color(.systemGray3), width: 1)

            Text("\(visibleStart + 1)-\(visibleEnd)/\(totalLines)")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding(4)
    }
}
