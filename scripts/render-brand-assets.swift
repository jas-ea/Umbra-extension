import AppKit
import Foundation

let repo = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let ink = NSColor(calibratedRed: 0.067, green: 0.071, blue: 0.078, alpha: 1)
let panel = NSColor(calibratedRed: 0.106, green: 0.110, blue: 0.122, alpha: 1)
let paper = NSColor(calibratedRed: 0.957, green: 0.953, blue: 0.933, alpha: 1)
let signal = NSColor(calibratedRed: 0.737, green: 0.906, blue: 0.357, alpha: 1)
let muted = NSColor(calibratedRed: 0.435, green: 0.455, blue: 0.490, alpha: 1)
let line = NSColor(calibratedRed: 0.204, green: 0.220, blue: 0.251, alpha: 1)

func roundedRect(_ rect: NSRect, radius: CGFloat, color: NSColor) {
  color.setFill()
  NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius).fill()
}

func strokeRoundedRect(_ rect: NSRect, radius: CGFloat, color: NSColor, width: CGFloat) {
  color.setStroke()
  let path = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
  path.lineWidth = width
  path.stroke()
}

func drawText(_ text: String, at point: NSPoint, size: CGFloat, weight: NSFont.Weight, color: NSColor) {
  NSAttributedString(
    string: text,
    attributes: [
      .font: NSFont.systemFont(ofSize: size, weight: weight),
      .foregroundColor: color,
    ]
  ).draw(at: point)
}

func drawMark(x: CGFloat, y: CGFloat, size: CGFloat, outlined: Bool = false) {
  let scale = size / 512
  let outer = NSRect(x: x + 48 * scale, y: y + 48 * scale, width: 416 * scale, height: 416 * scale)
  roundedRect(outer, radius: 96 * scale, color: outlined ? panel : ink)
  if outlined {
    strokeRoundedRect(outer, radius: 96 * scale, color: line, width: max(1, 6 * scale))
  }
  roundedRect(
    NSRect(x: x + 128 * scale, y: y + 132 * scale, width: 256 * scale, height: 18 * scale),
    radius: 9 * scale,
    color: muted
  )
  roundedRect(
    NSRect(x: x + 88 * scale, y: y + 188 * scale, width: 336 * scale, height: 136 * scale),
    radius: 24 * scale,
    color: paper
  )
  roundedRect(
    NSRect(x: x + 112 * scale, y: y + 212 * scale, width: 12 * scale, height: 88 * scale),
    radius: 6 * scale,
    color: signal
  )
  roundedRect(
    NSRect(x: x + 128 * scale, y: y + 362 * scale, width: 256 * scale, height: 18 * scale),
    radius: 9 * scale,
    color: muted
  )
}

func render(width: Int, height: Int, output: String, draw: () -> Void) throws {
  guard let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: width,
    pixelsHigh: height,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
  ), let baseContext = NSGraphicsContext(bitmapImageRep: bitmap) else {
    fatalError("Could not create image canvas")
  }

  let context = NSGraphicsContext(cgContext: baseContext.cgContext, flipped: true)
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = context
  draw()
  NSGraphicsContext.restoreGraphicsState()

  if let pixels = bitmap.bitmapData {
    let rowBytes = bitmap.bytesPerRow
    for row in 0..<(height / 2) {
      let opposite = height - row - 1
      let first = pixels.advanced(by: row * rowBytes)
      let second = pixels.advanced(by: opposite * rowBytes)
      for byte in 0..<rowBytes {
        let value = first[byte]
        first[byte] = second[byte]
        second[byte] = value
      }
    }
  }

  guard let png = bitmap.representation(using: .png, properties: [:]) else {
    fatalError("Could not encode \(output)")
  }
  try png.write(to: repo.appendingPathComponent(output), options: .atomic)
}

try render(width: 512, height: 512, output: "launch/assets/logo/umbra-mark.png") {
  drawMark(x: 0, y: 0, size: 512)
}

try render(width: 1200, height: 320, output: "launch/assets/logo/umbra-logo.png") {
  paper.setFill()
  NSBezierPath(rect: NSRect(x: 0, y: 0, width: 1200, height: 320)).fill()
  drawMark(x: 40, y: 20, size: 280)
  drawText("Umbra", at: NSPoint(x: 350, y: 89), size: 116, weight: .bold, color: ink)
}

try render(width: 440, height: 280, output: "launch/assets/poster/umbra-store-promo-440x280.png") {
  ink.setFill()
  NSBezierPath(rect: NSRect(x: 0, y: 0, width: 440, height: 280)).fill()
  drawMark(x: 34, y: 48, size: 184, outlined: true)
  drawText("Umbra", at: NSPoint(x: 230, y: 104), size: 50, weight: .bold, color: paper)
}

for size in [16, 32, 48, 128] {
  try render(width: size, height: size, output: "umbra-extension/icons/icon\(size).png") {
    drawMark(x: 0, y: 0, size: CGFloat(size))
  }
}
