// ============================================================
// Clef Surface SwiftUI Widget — StateMachineDiagram
//
// Visual state-and-transition diagram rendered on a Canvas.
// States display as circles with labels and transitions as
// arrows between them. The current state is highlighted.
// ============================================================

import SwiftUI

struct MachineState: Identifiable {
    var id: String { name }
    let name: String
    var initial: Bool = false
    var isFinal: Bool = false
}

struct MachineTransition: Identifiable {
    var id: String { "\(from)-\(event)-\(to)" }
    let from: String
    let to: String
    let event: String
}

struct StateMachineDiagramView: View {
    var states: [MachineState]
    var transitions: [MachineTransition]
    var currentState: String? = nil
    var canvasHeight: CGFloat = 200

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Canvas diagram
            Canvas { context, size in
                guard !states.isEmpty else { return }

                let centerX = size.width / 2
                let centerY = size.height / 2
                let radius = min(centerX, centerY) * 0.65
                let stateRadius: CGFloat = 28

                // Position states in a circle
                let positions: [String: CGPoint] = Dictionary(uniqueKeysWithValues:
                    states.enumerated().map { index, state in
                        let angle = (2 * .pi * CGFloat(index) / CGFloat(states.count)) - .pi / 2
                        return (state.name, CGPoint(
                            x: centerX + radius * cos(angle),
                            y: centerY + radius * sin(angle)
                        ))
                    }
                )

                // Draw transitions as arrows
                for t in transitions {
                    guard let from = positions[t.from], let to = positions[t.to] else { continue }

                    let dx = to.x - from.x
                    let dy = to.y - from.y
                    let dist = sqrt(dx * dx + dy * dy)
                    guard dist > 0 else { continue }
                    let nx = dx / dist
                    let ny = dy / dist

                    let start = CGPoint(x: from.x + nx * stateRadius, y: from.y + ny * stateRadius)
                    let end = CGPoint(x: to.x - nx * stateRadius, y: to.y - ny * stateRadius)

                    var linePath = Path()
                    linePath.move(to: start)
                    linePath.addLine(to: end)
                    context.stroke(linePath, with: .color(.gray), style: StrokeStyle(lineWidth: 2))

                    // Arrowhead
                    let arrowLen: CGFloat = 10
                    let arrowAngle: CGFloat = .pi / 7.2
                    let angle = atan2(ny, nx)

                    var arrow1 = Path()
                    arrow1.move(to: end)
                    arrow1.addLine(to: CGPoint(
                        x: end.x - arrowLen * cos(angle - arrowAngle),
                        y: end.y - arrowLen * sin(angle - arrowAngle)
                    ))
                    context.stroke(arrow1, with: .color(.gray), style: StrokeStyle(lineWidth: 2))

                    var arrow2 = Path()
                    arrow2.move(to: end)
                    arrow2.addLine(to: CGPoint(
                        x: end.x - arrowLen * cos(angle + arrowAngle),
                        y: end.y - arrowLen * sin(angle + arrowAngle)
                    ))
                    context.stroke(arrow2, with: .color(.gray), style: StrokeStyle(lineWidth: 2))
                }

                // Draw states as circles
                for state in states {
                    guard let pos = positions[state.name] else { continue }
                    let isCurrent = state.name == currentState

                    let rect = CGRect(x: pos.x - stateRadius, y: pos.y - stateRadius,
                                      width: stateRadius * 2, height: stateRadius * 2)

                    // Fill
                    context.fill(
                        Circle().path(in: rect),
                        with: .color(isCurrent ? Color.green : Color(.systemGray5))
                    )
                    // Border
                    context.stroke(
                        Circle().path(in: rect),
                        with: .color(isCurrent ? Color(red: 0.18, green: 0.49, blue: 0.20) : .gray),
                        style: StrokeStyle(lineWidth: state.isFinal ? 4 : 2)
                    )

                    // Initial state marker
                    if state.initial {
                        let dotCenter = CGPoint(x: pos.x - stateRadius - 8, y: pos.y)
                        let dotRect = CGRect(x: dotCenter.x - 4, y: dotCenter.y - 4, width: 8, height: 8)
                        context.fill(Circle().path(in: dotRect), with: .color(.gray))

                        var connPath = Path()
                        connPath.move(to: CGPoint(x: pos.x - stateRadius - 4, y: pos.y))
                        connPath.addLine(to: CGPoint(x: pos.x - stateRadius, y: pos.y))
                        context.stroke(connPath, with: .color(.gray), style: StrokeStyle(lineWidth: 2))
                    }
                }
            }
            .frame(height: canvasHeight)

            // Transition list
            Text("Transitions:")
                .font(.caption)
                .fontWeight(.bold)
                .foregroundColor(.secondary)

            ForEach(transitions) { t in
                let fromIsCurrent = t.from == currentState
                HStack(spacing: 4) {
                    Text("(\(t.from))")
                        .foregroundColor(fromIsCurrent ? .green : .primary)
                    Text("\u{2014}")
                        .foregroundColor(.secondary)
                    Text(t.event)
                        .foregroundColor(.purple)
                    Text("\u{2192}")
                        .foregroundColor(.secondary)
                    Text("(\(t.to))")
                }
                .font(.caption)
                .padding(.leading, 8)
            }

            // Legend
            HStack(spacing: 4) {
                Text("\u{25B8} initial   \u{25A0} final   ")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                Text("\u{25CF} current")
                    .font(.caption2)
                    .foregroundColor(.green)
            }
        }
        .padding(8)
    }
}
