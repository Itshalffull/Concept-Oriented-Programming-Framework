import SwiftUI

enum TraceStepControlsWidgetState { case paused, playing }

struct TraceStepControlsView: View {
    let currentStep: Int
    let totalSteps: Int
    let playing: Bool
    var speed: Int = 1
    var showSpeed: Bool = true
    var onStepForward: (() -> Void)?
    var onStepBack: (() -> Void)?
    var onPlay: (() -> Void)?
    var onPause: (() -> Void)?
    var onSeek: ((Int) -> Void)?
    var onFirst: (() -> Void)?
    var onLast: (() -> Void)?
    var onSpeedChange: ((Int) -> Void)?

    @State private var widgetState: TraceStepControlsWidgetState = .paused

    private var atFirst: Bool { currentStep <= 0 }
    private var atLast: Bool { currentStep >= totalSteps - 1 }
    private var progressPercent: Double { totalSteps > 0 ? Double(currentStep + 1) / Double(totalSteps) : 0 }

    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 12) {
                Button("\u{25C4}\u{2502}") { onFirst?() }.disabled(atFirst).accessibilityLabel("Jump to start")
                Button("\u{25C4}") { onStepBack?() }.disabled(atFirst).accessibilityLabel("Step backward")
                Button(playing ? "\u{23F8}" : "\u{25B6}") {
                    if playing { onPause?(); widgetState = .paused } else { onPlay?(); widgetState = .playing }
                }.accessibilityLabel(playing ? "Pause" : "Play")
                Button("\u{25BA}") { onStepForward?() }.disabled(atLast).accessibilityLabel("Step forward")
                Button("\u{2502}\u{25BA}") { onLast?() }.disabled(atLast).accessibilityLabel("Jump to end")
            }
            .buttonStyle(.bordered)

            Text("Step \(currentStep + 1) of \(totalSteps)")
                .font(.subheadline)
                .accessibilityLabel("Step \(currentStep + 1) of \(totalSteps)")

            ProgressView(value: progressPercent)
                .accessibilityLabel("Trace progress")

            if showSpeed {
                HStack(spacing: 4) {
                    ForEach([1, 2, 4], id: \.self) { s in
                        Button("\(s)x") { onSpeedChange?(s) }
                            .buttonStyle(.bordered).controlSize(.small)
                            .tint(s == speed ? .accentColor : .gray)
                            .accessibilityLabel("Playback speed \(s)x")
                    }
                }
            }
        }
        .onChange(of: playing) { newVal in widgetState = newVal ? .playing : .paused }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Trace step controls")
    }
}
