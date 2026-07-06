import SwiftUI

@MainActor
final class MemoryViewModel: ObservableObject {
    @Published var items: [MemoryItem] = []
    @Published var status: MemoryStatus?
    @Published var search = ""
    @Published var loading = false
    @Published var busy = false

    var filtered: [MemoryItem] {
        let q = search.trimmingCharacters(in: .whitespaces).lowercased()
        return q.isEmpty ? items : items.filter { $0.text.lowercased().contains(q) || $0.tag.lowercased().contains(q) }
    }

    func load(token: String) async {
        loading = true; defer { loading = false }
        items = (try? await API.memories(token: token)) ?? []
        status = try? await API.memoryStatus(token: token)
    }

    func add(_ text: String, token: String) async {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return }
        await API.addMemory(id: UUID().uuidString, text: t, tag: "note", token: token)
        await load(token: token)
    }

    func sync(token: String) async -> String {
        busy = true; defer { busy = false }
        guard let r = try? await API.commitMemory(token: token) else { return "Sync failed" }
        await load(token: token)
        if r.committed == true {
            return "Committed v\(r.version ?? 0) to 0G" + (r.registered == true ? " · owned on-chain" : "")
        }
        return r.note ?? "Nothing new to commit"
    }

    func consolidate(token: String) async -> String {
        busy = true; defer { busy = false }
        guard let r = try? await API.consolidate(apply: true, token: token) else { return "Consolidation failed" }
        await load(token: token)
        let folded = r.foldedAway ?? 0, pruned = r.pruned ?? 0, promoted = r.promoted ?? 0
        if folded + pruned + promoted == 0 { return "Memory is already clean" }
        return "Folded \(folded) · pruned \(pruned) · promoted \(promoted)"
    }
}

struct MemoryView: View {
    @EnvironmentObject var auth: AuthManager
    @StateObject private var vm = MemoryViewModel()
    @State private var toast: String?
    @State private var showAdd = false
    @State private var draft = ""
    private var token: String { auth.token ?? "" }

    var body: some View {
        NavigationStack {
            List {
                Section { ownershipBar }
                if vm.filtered.isEmpty && !vm.loading {
                    ContentUnavailableView("No memories yet", systemImage: "brain",
                                           description: Text("Chat with Mirrl, or add one — it remembers what matters."))
                } else {
                    ForEach(vm.filtered) { m in row(m) }
                }
            }
            .navigationTitle("Memory")
            .searchable(text: $vm.search, prompt: "Search your memory")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showAdd = true } label: { Image(systemName: "plus") }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button { Task { toast = await vm.consolidate(token: token) } } label: {
                            Label("Consolidate", systemImage: "sparkles")
                        }
                        Button { Task { toast = await vm.sync(token: token) } } label: {
                            Label("Sync to 0G", systemImage: "arrow.up.to.line")
                        }
                    } label: {
                        if vm.busy { ProgressView() } else { Image(systemName: "ellipsis.circle") }
                    }.disabled(vm.busy)
                }
            }
            .refreshable { await vm.load(token: token) }
            .task { await vm.load(token: token) }
            .overlay(alignment: .bottom) { if let toast { toastView(toast) } }
            .sheet(isPresented: $showAdd) { addSheet }
        }
    }

    private var addSheet: some View {
        NavigationStack {
            VStack {
                TextField("What should Mirrl remember?", text: $draft, axis: .vertical)
                    .lineLimit(2...5).padding().background(Color.white.opacity(0.06))
                    .clipShape(RoundedRectangle(cornerRadius: 12)).padding()
                Spacer()
            }
            .navigationTitle("New memory").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { showAdd = false; draft = "" } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let t = draft; draft = ""; showAdd = false
                        Task { await vm.add(t, token: token) }
                    }.disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }.presentationDetents([.height(220)])
    }

    private var ownershipBar: some View {
        HStack {
            Image(systemName: "lock.shield.fill").foregroundStyle(Color(hex: 0x7c5cff))
            VStack(alignment: .leading, spacing: 2) {
                Text("\(vm.status?.cached ?? vm.items.count) in working memory").font(.subheadline)
                if let v = vm.status?.version, v > 0 {
                    Text("committed v\(v) to 0G" + ((vm.status?.live ?? false) ? " · live" : ""))
                        .font(.caption).foregroundStyle(.secondary)
                } else {
                    Text("not yet committed to 0G").font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer()
        }
    }

    private func row(_ m: MemoryItem) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(m.text)
            HStack(spacing: 6) {
                tag(m.tag, color: .gray)
                tag((m.verified == true ? "✓ " : "") + m.tier, color: tierColor(m.tier))
            }
        }.padding(.vertical, 4)
    }

    private func tag(_ s: String, color: Color) -> some View {
        Text(s).font(.caption2).padding(.horizontal, 8).padding(.vertical, 3)
            .background(color.opacity(0.18)).foregroundStyle(color).clipShape(Capsule())
    }
    private func tierColor(_ t: String) -> Color { t == "durable" ? .green : t == "active" ? Color(hex: 0x7c5cff) : .gray }
    private func toastView(_ text: String) -> some View {
        Text(text).font(.subheadline).padding(12)
            .background(.ultraThinMaterial).clipShape(RoundedRectangle(cornerRadius: 12)).padding(.bottom, 12)
            .task { try? await Task.sleep(for: .seconds(3)); toast = nil }
    }
}
