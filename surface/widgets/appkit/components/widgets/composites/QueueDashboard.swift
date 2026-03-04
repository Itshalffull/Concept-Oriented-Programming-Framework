// ============================================================
// Clef Surface AppKit Widget — QueueDashboard
//
// Dashboard for monitoring job/task queues. Shows queue stats,
// active jobs, and controls for pause/resume/clear.
// ============================================================

import AppKit

public class ClefQueueDashboardView: NSView {
    public var queueName: String = "" { didSet { needsDisplay = true } }
    public var pending: Int = 0 { didSet { needsDisplay = true } }
    public var active: Int = 0 { didSet { needsDisplay = true } }
    public var completed: Int = 0 { didSet { needsDisplay = true } }
    public var failed: Int = 0 { didSet { needsDisplay = true } }
    public var onPause: (() -> Void)?
    public var onResume: (() -> Void)?
    public var onClear: (() -> Void)?

    private let pauseBtn = NSButton(title: "Pause", target: nil, action: nil)
    private let resumeBtn = NSButton(title: "Resume", target: nil, action: nil)
    private let clearBtn = NSButton(title: "Clear", target: nil, action: nil)

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        wantsLayer = true
        layer?.cornerRadius = 8
        layer?.backgroundColor = NSColor.controlBackgroundColor.cgColor
        pauseBtn.target = self; pauseBtn.action = #selector(handlePause); pauseBtn.bezelStyle = .rounded
        resumeBtn.target = self; resumeBtn.action = #selector(handleResume); resumeBtn.bezelStyle = .rounded
        clearBtn.target = self; clearBtn.action = #selector(handleClear); clearBtn.bezelStyle = .rounded
        addSubview(pauseBtn); addSubview(resumeBtn); addSubview(clearBtn)
    }

    @objc private func handlePause() { onPause?() }
    @objc private func handleResume() { onResume?() }
    @objc private func handleClear() { onClear?() }

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        let titleAttrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 14, weight: .semibold)]
        (queueName as NSString).draw(at: NSPoint(x: 16, y: bounds.height - 28), withAttributes: titleAttrs)
        let statAttrs: [NSAttributedString.Key: Any] = [.font: NSFont.monospacedDigitSystemFont(ofSize: 12, weight: .regular), .foregroundColor: NSColor.secondaryLabelColor]
        ("Pending: \(pending)  Active: \(active)  Completed: \(completed)  Failed: \(failed)" as NSString).draw(at: NSPoint(x: 16, y: bounds.height - 52), withAttributes: statAttrs)
    }

    public override func layout() {
        super.layout()
        let y: CGFloat = 12
        pauseBtn.frame = NSRect(x: 16, y: y, width: 64, height: 24)
        resumeBtn.frame = NSRect(x: 88, y: y, width: 72, height: 24)
        clearBtn.frame = NSRect(x: 168, y: y, width: 56, height: 24)
    }
}
