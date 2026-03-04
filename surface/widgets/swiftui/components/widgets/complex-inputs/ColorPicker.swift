// ============================================================
// Clef Surface SwiftUI Widget — ColorPicker
//
// Color selection control using SwiftUI ColorPicker with preset
// swatches and hex input.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// ColorPicker view for color selection with swatches and hex input.
///
/// - Parameters:
///   - value: Binding to the selected color hex string.
///   - presets: Array of preset color hex strings.
///   - enabled: Whether the picker is enabled.
///   - onColorChange: Callback when the selected color changes.
struct ColorPickerView: View {
    @Binding var value: String
    var presets: [String] = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF", "#FFFFFF", "#000000"]
    var enabled: Bool = true
    var onColorChange: ((String) -> Void)? = nil

    @State private var selectedColor: Color = .red
    @State private var hexInput: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Color preview
            RoundedRectangle(cornerRadius: 8)
                .fill(selectedColor)
                .frame(height: 48)
                .overlay(
                    Text(value)
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color(.systemGray3), lineWidth: 1)
                )

            // Native color picker
            SwiftUI.ColorPicker("Select Color", selection: $selectedColor)
                .disabled(!enabled)
                .onChange(of: selectedColor) { _, newColor in
                    let hex = colorToHex(newColor)
                    value = hex
                    hexInput = hex
                    onColorChange?(hex)
                }

            // Hex input
            TextField("Hex Color", text: $hexInput)
                .textFieldStyle(.roundedBorder)
                .disabled(!enabled)
                .onSubmit {
                    if let color = hexToColor(hexInput) {
                        selectedColor = color
                        value = hexInput.uppercased()
                        onColorChange?(hexInput.uppercased())
                    }
                }

            // Preset swatches
            Text("Presets")
                .font(.caption)
                .foregroundColor(.secondary)

            HStack(spacing: 8) {
                ForEach(presets, id: \.self) { preset in
                    let swatchColor = hexToColor(preset) ?? Color.gray
                    let isSelected = preset.lowercased() == value.lowercased()

                    Circle()
                        .fill(swatchColor)
                        .frame(width: 32, height: 32)
                        .overlay(
                            Circle()
                                .stroke(
                                    isSelected ? Color.accentColor : Color(.systemGray3),
                                    lineWidth: isSelected ? 2 : 1
                                )
                        )
                        .onTapGesture {
                            guard enabled else { return }
                            if let color = hexToColor(preset) {
                                selectedColor = color
                                value = preset
                                hexInput = preset
                                onColorChange?(preset)
                            }
                        }
                }
            }
        }
        .padding(8)
        .opacity(enabled ? 1.0 : 0.38)
        .onAppear {
            hexInput = value
            if let c = hexToColor(value) {
                selectedColor = c
            }
        }
    }

    private func colorToHex(_ color: Color) -> String {
        let components = color.cgColor?.components ?? [0, 0, 0, 1]
        let r = Int((components[safe: 0] ?? 0) * 255)
        let g = Int((components[safe: 1] ?? 0) * 255)
        let b = Int((components[safe: 2] ?? 0) * 255)
        return String(format: "#%02X%02X%02X", r, g, b)
    }

    private func hexToColor(_ hex: String) -> Color? {
        let cleaned = hex.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "#", with: "")
        guard cleaned.count == 6 else { return nil }
        guard let rgb = UInt64(cleaned, radix: 16) else { return nil }
        let r = Double((rgb >> 16) & 0xFF) / 255.0
        let g = Double((rgb >> 8) & 0xFF) / 255.0
        let b = Double(rgb & 0xFF) / 255.0
        return Color(red: r, green: g, blue: b)
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
