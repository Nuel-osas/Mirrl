import SwiftUI

// Lightweight markdown → AttributedString for chat bubbles. Handles headers,
// bullet lists, and inline **bold** / *italic* / `code` / links — without a
// dependency. (SwiftUI's inline markdown parser does the inline work per line.)
enum Markdown {
    static func render(_ md: String) -> AttributedString {
        var out = AttributedString()
        let lines = md.components(separatedBy: "\n")
        for (i, raw) in lines.enumerated() {
            out += line(raw)
            if i < lines.count - 1 { out += AttributedString("\n") }
        }
        return out
    }

    private static func inline(_ s: String) -> AttributedString {
        (try? AttributedString(
            markdown: s,
            options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        )) ?? AttributedString(s)
    }

    private static func line(_ raw: String) -> AttributedString {
        // headers: #, ##, ### …
        if let r = raw.range(of: "^#{1,6}\\s+", options: .regularExpression) {
            var a = inline(String(raw[r.upperBound...]))
            a.font = .system(.headline).bold()
            return a
        }
        // bullets: "- " or "* "
        if let r = raw.range(of: "^\\s*[-*]\\s+", options: .regularExpression) {
            return AttributedString("•  ") + inline(String(raw[r.upperBound...]))
        }
        return inline(raw)
    }
}
