// ============================================================
// Clef Surface SwiftUI Widget — CronEditor
//
// Visual cron expression builder rendered as a row of text
// fields for the five cron parts (minute, hour, day, month,
// weekday) with a human-readable schedule summary below.
// ============================================================

import SwiftUI

private let fieldLabels = ["min", "hour", "day", "month", "weekday"]

private func describeCron(_ parts: [String]) -> String {
    guard parts.count == 5 else { return "Invalid cron expression" }

    let min = parts[0], hour = parts[1], day = parts[2], month = parts[3], weekday = parts[4]

    if parts.allSatisfy({ $0 == "*" }) { return "Every minute" }
    if min != "*" && hour == "*" && day == "*" && month == "*" && weekday == "*" {
        return "At minute \(min) of every hour"
    }
    if min != "*" && hour != "*" && day == "*" && month == "*" && weekday == "*" {
        return "Daily at \(hour):\(min.padding(toLength: 2, withPad: "0", startingAt: 0))"
    }
    if weekday != "*" && day == "*" {
        let days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        let dayName = Int(weekday).flatMap({ days.indices.contains($0) ? days[$0] : nil }) ?? weekday
        let h = hour.isEmpty ? "*" : hour
        let m = (min.isEmpty ? "*" : min).padding(toLength: 2, withPad: "0", startingAt: 0)
        return "Every \(dayName) at \(h):\(m)"
    }
    if day != "*" && month == "*" {
        let h = hour.isEmpty ? "*" : hour
        let m = (min.isEmpty ? "*" : min).padding(toLength: 2, withPad: "0", startingAt: 0)
        return "Monthly on day \(day) at \(h):\(m)"
    }

    return parts.joined(separator: " ")
}

struct CronEditorView: View {
    @Binding var value: String
    var onValueChange: ((String) -> Void)? = nil

    private var parts: [String] {
        var p = value.components(separatedBy: .whitespaces).filter { !$0.isEmpty }
        while p.count < 5 { p.append("*") }
        return Array(p.prefix(5))
    }

    private var summary: String {
        describeCron(parts)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Field labels and inputs
            HStack(spacing: 8) {
                ForEach(Array(fieldLabels.enumerated()), id: \.offset) { index, label in
                    VStack(spacing: 4) {
                        Text(label)
                            .font(.caption2)
                            .foregroundColor(.secondary)

                        TextField("*", text: Binding(
                            get: { parts.indices.contains(index) ? parts[index] : "*" },
                            set: { newVal in
                                var newParts = parts
                                newParts[index] = newVal.isEmpty ? "*" : newVal
                                let newValue = newParts.joined(separator: " ")
                                value = newValue
                                onValueChange?(newValue)
                            }
                        ))
                        .textFieldStyle(.roundedBorder)
                        .multilineTextAlignment(.center)
                        .frame(minWidth: 50)
                    }
                }
            }

            // Human-readable summary
            HStack(spacing: 8) {
                Text("\u{23F0}")
                    .font(.body)
                Text(summary)
                    .font(.body)
                    .fontWeight(.bold)
            }
        }
        .padding(8)
    }
}
