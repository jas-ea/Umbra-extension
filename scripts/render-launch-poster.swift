import AppKit
import Foundation

let width = 1200
let height = 628
let repo = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let screenshotURL = repo.appendingPathComponent("launch/assets/screenshots/stackoverflow-questions.png")
let outputURL = repo.appendingPathComponent("launch/assets/poster/umbra-launch-poster.png")

guard let screenshot = NSImage(contentsOf: screenshotURL) else {
  fatalError("Could not load \(screenshotURL.path)")
}

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
) else {
  fatalError("Could not create poster canvas")
}

guard let baseContext = NSGraphicsContext(bitmapImageRep: bitmap) else {
  fatalError("Could not create poster context")
}
let context = NSGraphicsContext(cgContext: baseContext.cgContext, flipped: true)
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = context

let ink = NSColor(calibratedRed: 0.067, green: 0.071, blue: 0.078, alpha: 1)
let paper = NSColor(calibratedRed: 0.957, green: 0.953, blue: 0.933, alpha: 1)
let signal = NSColor(calibratedRed: 0.737, green: 0.906, blue: 0.357, alpha: 1)
let secondary = NSColor(calibratedRed: 0.749, green: 0.765, blue: 0.792, alpha: 1)
let quiet = NSColor(calibratedRed: 0.522, green: 0.545, blue: 0.584, alpha: 1)
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

func drawText(
  _ text: String,
  at point: NSPoint,
  size: CGFloat,
  weight: NSFont.Weight,
  color: NSColor
) {
  let attributes: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: size, weight: weight),
    .foregroundColor: color,
  ]
  NSAttributedString(string: text, attributes: attributes).draw(at: point)
}

ink.setFill()
NSBezierPath(rect: NSRect(x: 0, y: 0, width: width, height: height)).fill()

strokeRoundedRect(NSRect(x: 64, y: 58, width: 47, height: 13), radius: 2, color: paper, width: 2)
roundedRect(NSRect(x: 78, y: 77, width: 47, height: 13), radius: 2, color: signal)
strokeRoundedRect(NSRect(x: 64, y: 96, width: 47, height: 13), radius: 2, color: paper, width: 2)
drawText("Umbra", at: NSPoint(x: 139, y: 59), size: 30, weight: .semibold, color: paper)

roundedRect(NSRect(x: 54, y: 124, width: 42, height: 5), radius: 2.5, color: signal)
drawText("Keep your place", at: NSPoint(x: 54, y: 164), size: 58, weight: .bold, color: paper)
drawText("on busy pages.", at: NSPoint(x: 54, y: 228), size: 58, weight: .bold, color: paper)
drawText("The page dims around one block.", at: NSPoint(x: 56, y: 343), size: 22, weight: .regular, color: secondary)
drawText("The original site stays interactive.", at: NSPoint(x: 56, y: 377), size: 22, weight: .regular, color: secondary)
drawText("Chrome extension by Cassini Research", at: NSPoint(x: 56, y: 533), size: 17, weight: .medium, color: quiet)

roundedRect(NSRect(x: 530, y: 77, width: 628, height: 474), radius: 14, color: NSColor.black)
strokeRoundedRect(NSRect(x: 530.5, y: 77.5, width: 627, height: 473), radius: 14, color: line, width: 1)

let target = NSRect(x: 544, y: 91, width: 600, height: 446)
let imageSize = screenshot.size
let targetRatio = target.width / target.height
let imageRatio = imageSize.width / imageSize.height
let source: NSRect
if imageRatio > targetRatio {
  let sourceWidth = imageSize.height * targetRatio
  source = NSRect(
    x: (imageSize.width - sourceWidth) / 2,
    y: 0,
    width: sourceWidth,
    height: imageSize.height
  )
} else {
  let sourceHeight = imageSize.width / targetRatio
  source = NSRect(
    x: 0,
    y: (imageSize.height - sourceHeight) / 2,
    width: imageSize.width,
    height: sourceHeight
  )
}

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

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = baseContext
NSBezierPath(roundedRect: target, xRadius: 10, yRadius: 10).addClip()
screenshot.draw(
  in: target,
  from: source,
  operation: .copy,
  fraction: 1,
  respectFlipped: false,
  hints: [.interpolation: NSImageInterpolation.high]
)
NSGraphicsContext.restoreGraphicsState()

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = baseContext
strokeRoundedRect(target, radius: 10, color: NSColor.white.withAlphaComponent(0.16), width: 1)
NSGraphicsContext.restoreGraphicsState()

guard let png = bitmap.representation(using: .png, properties: [:]) else {
  fatalError("Could not encode poster PNG")
}
try png.write(to: outputURL, options: .atomic)
