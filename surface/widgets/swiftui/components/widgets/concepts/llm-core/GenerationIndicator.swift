import SwiftUI

enum GenerationIndicatorWidgetState {
    case idle, generating, complete, error
}

enum GenerationIndicatorEvent {
    case start, token, complete, error, reset, retry
}

func generationIndicatorReduce(state: GenerationIndicatorWidgetState, event: GenerationIndicatorEvent) -> GenerationIndicatorWidgetState {
    switch state {
    case .idle:
        if event == .start { return .generating }
        return state
    case .generating:
        if event == .token { return .generating }
        if event == .complete { return .complete }
        if event == .error { return .error }
        return state
    case .complete:
        if event == .reset { return .idle }
        if event == .start { return .generating }
        return state
    case .error:
        if event == .reset { return .idle }
        if event == .retry { return .generating }
        return state
    }
}

struct GenerationIndicatorView: View {
    var status: GenerationIndicatorWidgetState
    var model: String? = nil
    var tokenCount: Int? = nil
    var showTokens: Bool = true
    var showModel: Bool = true
    var showElapsed: Bool = true
    var variant: String = "dots"
    var cancelable: Bool = false
    var onCancel: (() -> Void)? = nil
    var onRetry: (() -> Void)? = nil

    @State private var widgetState: GenerationIndicatorWidgetState = .idle
    @State private var elapsedSeconds: Int = 0
    @State private var finalElapsed: Int = 0
    @State private var dotCount: Int = 1
    @State private var spinAngle: Double = 0
    @State private var barOffset: CGFloat = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    private let animTimer = Timer.publish(every: 0.4, on: .main, in: .common).autoconnect()

    private func syncState() {
        switch status {
        case .generating:
            if widgetState == .idle || widgetState == .complete || widgetState == .error {
                widgetState = generationIndicatorReduce(state: widgetState, event: widgetState == .error ? .retry : .start)
            }
        case .complete:
            if widgetState == .generating {
                finalElapsed = elapsedSeconds
                widgetState = generationIndicatorReduce(state: widgetState, event: .complete)
            }
        case .error:
            if widgetState == .generating {
                finalElapsed = elapsedSeconds
                widgetState = generationIndicatorReduce(state: widgetState, event: .error)
            }
        case .idle:
            if widgetState == .complete || widgetState == .error {
                widgetState = generationIndicatorReduce(state: widgetState, event: .reset)
                elapsedSeconds = 0
                finalElapsed = 0
            }
        }
    }

    private func formatElapsed(_ seconds: Int) -> String {
        if seconds < 60 { return "\(seconds)s" }
        let m = seconds / 60
        let s = seconds % 60
        return s > 0 ? "\(m)m \(s)s" : "\(m)m"
    }

    private var statusText: String {
        switch widgetState {
        case .generating: return "Generating..."
        case .complete: return "Complete"
        case .error: return "Error"
        case .idle: return ""
        }
    }

    private var elapsedText: String {
        switch widgetState {
        case .generating: return formatElapsed(elapsedSeconds)
        case .complete, .error: return formatElapsed(finalElapsed)
        case .idle: return ""
        }
    }

    private var statusColor: Color {
        switch widgetState {
        case .generating: return .blue
        case .complete: return .green
        case .error: return .red
        case .idle: return .secondary
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if widgetState == .generating {
                HStack(spacing: 4) {
                    switch variant {
                    case "spinner":
                        Image(systemName: "arrow.clockwise")
                            .rotationEffect(.degrees(reduceMotion ? 0 : spinAngle))
                            .accessibilityHidden(true)
                    case "bar":
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                RoundedRectangle(cornerRadius: 3)
                                    .fill(Color.primary.opacity(0.2))
                                    .frame(height: 6)
                                RoundedRectangle(cornerRadius: 3)
                                    .fill(Color.primary)
                                    .frame(width: geo.size.width * 0.4, height: 6)
                                    .offset(x: reduceMotion ? 0 : barOffset * (geo.size.width * 0.6))
                            }
                        }
                        .frame(width: 60, height: 6)
                        .accessibilityHidden(true)
                    default:
                        Text(String(repeating: ".", count: dotCount))
                            .font(.system(.body, design: .monospaced))
                            .frame(width: 30, alignment: .leading)
                            .accessibilityHidden(true)
                    }
                }
            }

            if !statusText.isEmpty {
                Text(statusText)
                    .font(.body)
                    .foregroundColor(statusColor)
            }

            if showModel, let model = model {
                Text(model)
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(Color.secondary.opacity(0.15))
                    .cornerRadius(4)
            }

            if showTokens, let count = tokenCount {
                Text("\(count) tokens")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .accessibilityLabel("\(count) tokens generated")
            }

            if showElapsed && (widgetState == .generating || widgetState == .complete) {
                Text(elapsedText)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            if widgetState == .error {
                Button("Retry") {
                    onRetry?()
                }
                .accessibilityLabel("Retry generation")
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Generation \(String(describing: widgetState))")
        .onChange(of: status) { _ in syncState() }
        .onAppear { syncState() }
        .onReceive(timer) { _ in
            if widgetState == .generating {
                elapsedSeconds += 1
            }
        }
        .onReceive(animTimer) { _ in
            guard widgetState == .generating, !reduceMotion else { return }
            withAnimation {
                dotCount = (dotCount % 3) + 1
                spinAngle += 90
                barOffset = barOffset >= 1.0 ? 0 : barOffset + 0.2
            }
        }
    }
}
