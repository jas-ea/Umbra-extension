import AppKit
import Foundation

let width = 1200
let height = 628
let repo = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let screenshotURL = repo.appendingPathComponent("launch/assets/screenshots/github-openai-cookbook-issues.png")
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

func drawMark(x: CGFloat, y: CGFloat, size: CGFloat) {
  let scale = size / 512
  roundedRect(
    NSRect(x: x + 48 * scale, y: y + 48 * scale, width: 416 * scale, height: 416 * scale),
    radius: 96 * scale,
    color: NSColor(calibratedRed: 0.106, green: 0.110, blue: 0.122, alpha: 1)
  )
  strokeRoundedRect(
    NSRect(x: x + 48 * scale, y: y + 48 * scale, width: 416 * scale, height: 416 * scale),
    radius: 96 * scale,
    color: line,
    width: max(1, 8 * scale)
  )
  roundedRect(
    NSRect(x: x + 128 * scale, y: y + 132 * scale, width: 256 * scale, height: 18 * scale),
    radius: 9 * scale,
    color: quiet
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
    color: quiet
  )
}

ink.setFill()
NSBezierPath(rect: NSRect(x: 0, y: 0, width: width, height: height)).fill()

drawMark(x: 44, y: 33, size: 54)
drawText("Umbra", at: NSPoint(x: 112, y: 54), size: 30, weight: .bold, color: paper)

drawText("Darken the page", at: NSPoint(x: 44, y: 142), size: 50, weight: .bold, color: paper)
drawText("around what", at: NSPoint(x: 44, y: 200), size: 50, weight: .bold, color: paper)
drawText("you're using.", at: NSPoint(x: 44, y: 258), size: 50, weight: .bold, color: paper)
drawText("Pause on a section. Umbra keeps it clear", at: NSPoint(x: 46, y: 384), size: 21, weight: .regular, color: secondary)
drawText("and darkens everything around it.", at: NSPoint(x: 46, y: 416), size: 21, weight: .regular, color: secondary)
drawText("Open-source Chrome extension by Cassini Research", at: NSPoint(x: 46, y: 536), size: 17, weight: .medium, color: quiet)

roundedRect(NSRect(x: 492, y: 98, width: 674, height: 432), radius: 14, color: NSColor.black)
strokeRoundedRect(NSRect(x: 492.5, y: 98.5, width: 673, height: 431), radius: 14, color: line, width: 1)

let target = NSRect(x: 506, y: 112, width: 646, height: 404)
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
