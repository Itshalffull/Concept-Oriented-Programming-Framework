// ============================================================
// Clef Surface SwiftUI Widget — CanvasConnector
//
// Edge or arrow connecting two canvas nodes. Draws a line between
// two offset positions on a Canvas with an optional label rendered
// at the midpoint.
// ============================================================

import SwiftUI

struct CanvasConnectorView: View {
    var fromPoint: CGPoint
    var toPoint: CGPoint
    var label: String? = nil
    var lineColor: Color = .gray
    var strokeWidth: CGFloat = 2

    var body: some View {
        ZStack {
            Canvas { context, size in
                // Draw connector line
                var linePath = Path()
                linePath.move(to: fromPoint)
                linePath.addLine(to: toPoint)
                context.stroke(linePath, with: .color(lineColor), style: StrokeStyle(lineWidth: strokeWidth, lineCap: .round))

                // Draw arrowhead
                let angle = atan2(toPoint.y - fromPoint.y, toPoint.x - fromPoint.x)
                let arrowLen: CGFloat = 12
                let arrowAngle: CGFloat = .pi / 7.2 // ~25 degrees

                let x1 = toPoint.x - arrowLen * cos(angle - arrowAngle)
                let y1 = toPoint.y - arrowLen * sin(angle - arrowAngle)
                let x2 = toPoint.x - arrowLen * cos(angle + arrowAngle)
                let y2 = toPoint.y - arrowLen * sin(angle + arrowAngle)

                var arrow1 = Path()
                arrow1.move(to: toPoint)
                arrow1.addLine(to: CGPoint(x: x1, y: y1))
                context.stroke(arrow1, with: .color(lineColor), style: StrokeStyle(lineWidth: strokeWidth))

                var arrow2 = Path()
                arrow2.move(to: toPoint)
                arrow2.addLine(to: CGPoint(x: x2, y: y2))
                context.stroke(arrow2, with: .color(lineColor), style: StrokeStyle(lineWidth: strokeWidth))
            }

            // Midpoint label
            if let label = label {
                let mid = CGPoint(
                    x: (fromPoint.x + toPoint.x) / 2,
                    y: (fromPoint.y + toPoint.y) / 2 - 8
                )
                Text(label)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .position(mid)
            }
        }
    }
}
