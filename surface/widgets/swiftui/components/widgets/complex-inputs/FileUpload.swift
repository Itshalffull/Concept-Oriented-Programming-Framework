// ============================================================
// Clef Surface SwiftUI Widget — FileUpload
//
// File upload control with drag-and-drop zone and file picker.
// Displays selected files with remove capability.
// ============================================================

import SwiftUI

// --------------- Types ---------------

struct UploadedFile: Identifiable {
    let id = UUID()
    let name: String
    let size: String
}

// --------------- Component ---------------

/// FileUpload view for file selection and upload.
///
/// - Parameters:
///   - files: Binding to the array of uploaded files.
///   - accept: Accepted file types.
///   - multiple: Whether multiple files can be selected.
///   - maxSize: Maximum file size description.
///   - enabled: Whether the upload is enabled.
///   - onUpload: Callback when files are uploaded.
///   - onRemove: Callback when a file is removed.
struct FileUploadView: View {
    @Binding var files: [UploadedFile]
    var accept: String = "*/*"
    var multiple: Bool = true
    var maxSize: String = "10 MB"
    var enabled: Bool = true
    var onUpload: (([UploadedFile]) -> Void)? = nil
    var onRemove: ((UploadedFile) -> Void)? = nil

    var body: some View {
        VStack(spacing: 12) {
            // Drop zone
            VStack(spacing: 8) {
                Image(systemName: "arrow.up.circle")
                    .font(.system(size: 32))
                    .foregroundColor(.secondary)
                Text("Drop files here or tap to browse")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                Text("Max size: \(maxSize)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(24)
            .background(Color(.systemGray6))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(style: StrokeStyle(lineWidth: 2, dash: [8]))
                    .foregroundColor(Color(.systemGray4))
            )
            .opacity(enabled ? 1.0 : 0.38)

            // File list
            ForEach(files) { file in
                HStack {
                    Image(systemName: "doc")
                        .foregroundColor(.accentColor)
                    VStack(alignment: .leading) {
                        Text(file.name)
                            .font(.subheadline)
                        Text(file.size)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    SwiftUI.Button(action: {
                        files.removeAll { $0.id == file.id }
                        onRemove?(file)
                    }) {
                        Image(systemName: "xmark")
                            .foregroundColor(.secondary)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Remove \(file.name)")
                }
                .padding(8)
            }
        }
    }
}
