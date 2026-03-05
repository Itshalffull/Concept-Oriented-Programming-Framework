import SwiftUI

// State machine: paused | playing
enum TraceStepControlsWatchState {
    case paused
    case playing
}

enum TraceStepControlsWatchEvent {
    case play
    case pause
    case stepFwd
    case stepBack
    case jumpStart
    case jumpEnd
    case reachEnd
}

func traceStepControlsWatchReduce(_ state: TraceStepControlsWatchState, _ event: TraceStepControlsWatchEvent) -> TraceStepControlsWatchState {
    switch state {
    case .paused:
        if case .play = event { return .playing }
        return state
    case .playing:
        switch event {
        case .pause, .reachEnd: return .paused
        default: return state
        }
    }
}

struct TraceStepControlsWatchView: View {
    let currentStep: Int
    let totalSteps: Int
    @Binding var playing: Bool
    var speed: Int = 1
    var onStepForward: (() -> Void)? = nil
    var onStepBack: (() -> Void)? = nil
    var onPlay: (() -> Void)? = nil
    var onPause: (() -> Void)? = nil
    var onFirst: (() -> Void)? = nil
    var onLast: (() -> Void)? = nil

    @State private var state: TraceStepControlsWatchState = .paused

    private var atFirst: Bool { currentStep <= 0 }
    private var atLast: Bool { currentStep >= totalSteps - 1 }
    private var progressPercent: Double {
        totalSteps > 0 ? Double(currentStep + 1) / Double(totalSteps) : 0
    }

    var body: some View {
        VStack(spacing: 6) {
            // Step counter
            Text("Step \(currentStep + 1)/\(totalSteps)")
                .font(.caption2)
                .fontWeight(.semibold)

            // Progress bar
            ProgressView(value: progressPercent)
                .tint(.blue)

            // Transport controls
            HStack(spacing: 8) {
                Button {
                    onFirst?()
                    state = traceStepControlsWatchReduce(state, .jumpStart)
                } label: {
                    Image(systemName: "backward.end.fill")
                        .font(.system(size: 12))
                }
                .disabled(atFirst)

                Button {
                    onStepBack?()
                    state = traceStepControlsWatchReduce(state, .stepBack)
                } label: {
                    Image(systemName: "backward.fill")
                        .font(.system(size: 12))
                }
                .disabled(atFirst)

                Button {
                    if state == .playing {
                        state = traceStepControlsWatchReduce(state, .pause)
                        playing = false
                        onPause?()
                    } else {
                        if !atLast {
                            state = traceStepControlsWatchReduce(state, .play)
                            playing = true
                            onPlay?()
                        }
                    }
                } label: {
                    Image(systemName: state == .playing ? "pause.fill" : "play.fill")
                        .font(.system(size: 14))
                }

                Button {
                    onStepForward?()
                    state = traceStepControlsWatchReduce(state, .stepFwd)
                } label: {
                    Image(systemName: "forward.fill")
                        .font(.system(size: 12))
                }
                .disabled(atLast)

                Button {
                    onLast?()
                    state = traceStepControlsWatchReduce(state, .jumpEnd)
                } label: {
                    Image(systemName: "forward.end.fill")
                        .font(.system(size: 12))
                }
                .disabled(atLast)
            }

            // Speed indicator
            Text("\(speed)x")
                .font(.system(size: 9))
                .foregroundColor(.secondary)
        }
        .padding(.horizontal, 4)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Trace step controls, step \(currentStep + 1) of \(totalSteps)")
    }
}
