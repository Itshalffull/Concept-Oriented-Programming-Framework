// ============================================================
// Clef Surface SwiftUI Widget — Canvas
//
// Infinite two-dimensional spatial plane for placing and
// manipulating visual elements. Uses a SwiftUI Canvas for
// drawing a grid background with coordinate/zoom indicators
// and renders child content overlaid on the canvas region.
// ============================================================

import SwiftUI

struct ClefCanvasView<Content: View>: View {
    var canvasWidth: CGFloat = 400
    var canvasHeight: CGFloat = 300
    var zoom: CGFloat = 1.0
    var panX: CGFloat = 0
    var panY: CGFloat = 0
    var gridSize: CGFloat = 24
    var gridColor: Color = Color.gray.opacity(0.3)
    @ViewBuilder var content: Content

    private var zoomPercent: Int { Int(zoom * 100) }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Header bar
            HStack {
                Text("Canvas")
                    .font(.headline)
                    .fontWeight(.bold)
                Text("  zoom:\(zoomPercent)%  pan:(\(Int(panX)),\(Int(panY)))")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            // Canvas area
            ZStack {
                Canvas { context, size in
                    let gridPx = gridSize * zoom
                    guard gridPx > 4 else { return }

                    let dashStyle = StrokeStyle(lineWidth: 1, dash: [2, 4])

                    // Vertical lines
                    var x = ((panX.truncatingRemainder(dividingBy: gridPx)) + gridPx).truncatingRemainder(dividingBy: gridPx)
                    while x < size.width {
                        var path = Path()
                        path.move(to: CGPoint(x: x, y: 0))
                        path.addLine(to: CGPoint(x: x, y: size.height))
                        context.stroke(path, with: .color(gridColor), style: dashStyle)
                        x += gridPx
                    }

                    // Horizontal lines
                    var y = ((panY.truncatingRemainder(dividingBy: gridPx)) + gridPx).truncatingRemainder(dividingBy: gridPx)
                    while y < size.height {
                        var path = Path()
                        path.move(to: CGPoint(x: 0, y: y))
                        path.addLine(to: CGPoint(x: size.width, y: y))
                        context.stroke(path, with: .color(gridColor), style: dashStyle)
                        y += gridPx
                    }
                }

                content
            }
            .frame(width: canvasWidth, height: canvasHeight)
            .border(Color(.systemGray3), width: 1)

            // Coordinate display
            Text("origin: (\(Int(panX)),\(Int(panY))) | \(zoomPercent)%")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(8)
    }
}
