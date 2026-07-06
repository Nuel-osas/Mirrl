import SwiftUI

struct BrainView: View {
    @EnvironmentObject var auth: AuthManager
    @State private var items: [MemoryItem] = []
    @State private var status: MemoryStatus?
    private var token: String { auth.token ?? "" }

    var body: some View {
        GeometryReader { geo in
            let center = CGPoint(x: geo.size.width / 2, y: geo.size.height / 2)
            let radius = min(geo.size.width, geo.size.height) * 0.34

            ZStack {
                // connector lines
                Canvas { ctx, _ in
                    for i in items.indices {
                        var path = Path()
                        path.move(to: center)
                        path.addLine(to: pos(i, center: center, radius: radius))
                        ctx.stroke(path, with: .color(.white.opacity(0.08)), lineWidth: 1)
                    }
                }

                // central core
                core.position(center)

                // memory nodes
                ForEach(Array(items.enumerated()), id: \.element.id) { i, m in
                    node(m).position(pos(i, center: center, radius: radius))
                }

                if items.isEmpty {
                    Text("Chat with Mirrl — your brain grows as it remembers.")
                        .font(.footnote).foregroundStyle(.secondary)
                        .position(x: center.x, y: center.y + radius + 60)
                }
            }
        }
        .background(Color.black)
        .overlay(alignment: .top) { statusBar.padding(.top, 8) }
        .task { await load() }
    }

    private func pos(_ i: Int, center: CGPoint, radius: CGFloat) -> CGPoint {
        let n = max(items.count, 1)
        // two rings when there are many nodes, so they don't overlap
        let ring = i >= 10 ? radius * 1.55 : radius
        let count = items.count > 10 ? (i < 10 ? 10 : items.count - 10) : n
        let idx = i >= 10 ? i - 10 : i
        let angle = Double(idx) * (2 * .pi / Double(max(count, 1))) - .pi / 2
        return CGPoint(x: center.x + CGFloat(cos(angle)) * ring, y: center.y + CGFloat(sin(angle)) * ring)
    }

    private var core: some View {
        VStack(spacing: 4) {
            ZStack {
                Circle().fill(.purple.opacity(0.25)).frame(width: 120, height: 120).blur(radius: 24)
                Circle()
                    .fill(LinearGradient(colors: [Color(hex: 0xff5fd2), Color(hex: 0x7c5cff)],
                                         startPoint: .topLeading, endPoint: .bottomTrailing))
                    .frame(width: 60, height: 60)
                    .overlay(Image(systemName: "brain.head.profile").foregroundStyle(.white))
            }
            Text("your memory").font(.caption).foregroundStyle(.secondary)
            Text("\(items.count) memories").font(.caption2).foregroundStyle(.tertiary)
        }
    }

    private func node(_ m: MemoryItem) -> some View {
        let s = m.strength ?? 0.5
        let durable = s >= 0.66
        return Text(m.text)
            .font(.caption2).lineLimit(2).multilineTextAlignment(.center)
            .frame(maxWidth: 110)
            .padding(.horizontal, 8).padding(.vertical, 5)
            .background(Color.white.opacity(0.06))
            .overlay(RoundedRectangle(cornerRadius: 10)
                .stroke(durable ? Color(hex: 0x7c5cff) : .white.opacity(0.12), lineWidth: durable ? 1.5 : 1))
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .opacity(0.5 + 0.5 * s)
            .shadow(color: durable ? Color(hex: 0x7c5cff).opacity(0.5) : .clear, radius: 8)
    }

    private var statusBar: some View {
        HStack(spacing: 6) {
            Image(systemName: "lock.shield.fill").font(.caption2).foregroundStyle(Color(hex: 0x7c5cff))
            Text("\(status?.cached ?? items.count) memories")
            if let v = status?.version, v > 0 {
                Text("· committed v\(v) to 0G").foregroundStyle(.secondary)
            }
        }
        .font(.caption)
        .padding(.horizontal, 12).padding(.vertical, 6)
        .background(.ultraThinMaterial).clipShape(Capsule())
    }

    private func load() async {
        items = (try? await API.memories(token: token)) ?? []
        status = try? await API.memoryStatus(token: token)
    }
}
