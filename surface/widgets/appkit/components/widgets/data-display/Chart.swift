// ============================================================
// Clef Surface AppKit Widget — Chart
//
// Basic chart renderer for bar, line, and pie visualizations.
// Uses Core Graphics drawing for lightweight chart display.
// ============================================================

import AppKit

public class ClefChartView: NSView {
    public enum ChartType { case bar, line, pie }

    public var chartType: ChartType = .bar { didSet { needsDisplay = true } }
    public var data: [Double] = [] { didSet { needsDisplay = true } }
    public var labels: [String] = [] { didSet { needsDisplay = true } }
    public var colors: [NSColor] = [.systemBlue, .systemGreen, .systemOrange, .systemRed, .systemPurple]

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        guard !data.isEmpty else { return }

        switch chartType {
        case .bar: drawBarChart()
        case .line: drawLineChart()
        case .pie: drawPieChart()
        }
    }

    private func drawBarChart() {
        let maxVal = data.max() ?? 1
        let barWidth = bounds.width / CGFloat(data.count) - 4
        for (i, val) in data.enumerated() {
            let height = (val / maxVal) * (bounds.height - 20)
            let x = CGFloat(i) * (barWidth + 4) + 2
            let rect = NSRect(x: x, y: 0, width: barWidth, height: height)
            colors[i % colors.count].setFill()
            NSBezierPath(roundedRect: rect, xRadius: 2, yRadius: 2).fill()
        }
    }

    private func drawLineChart() {
        guard data.count > 1 else { return }
        let maxVal = data.max() ?? 1
        let path = NSBezierPath()
        let stepX = bounds.width / CGFloat(data.count - 1)
        for (i, val) in data.enumerated() {
            let point = NSPoint(x: CGFloat(i) * stepX, y: (val / maxVal) * (bounds.height - 20))
            if i == 0 { path.move(to: point) } else { path.line(to: point) }
        }
        colors[0].setStroke()
        path.lineWidth = 2
        path.stroke()
    }

    private func drawPieChart() {
        let total = data.reduce(0, +)
        guard total > 0 else { return }
        let center = NSPoint(x: bounds.midX, y: bounds.midY)
        let radius = min(bounds.width, bounds.height) / 2 - 10
        var startAngle: CGFloat = 90
        for (i, val) in data.enumerated() {
            let sweep = CGFloat(val / total) * 360
            let path = NSBezierPath()
            path.move(to: center)
            path.appendArc(withCenter: center, radius: radius, startAngle: startAngle, endAngle: startAngle - sweep, clockwise: true)
            path.close()
            colors[i % colors.count].setFill()
            path.fill()
            startAngle -= sweep
        }
    }
}
