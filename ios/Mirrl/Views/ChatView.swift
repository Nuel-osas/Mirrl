import SwiftUI

// Auto-remember heuristics — mirror the web (only store genuine personal facts).
enum Remember {
    static func isQuestion(_ t: String) -> Bool {
        let s = t.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if s.hasSuffix("?") { return true }
        let starts = ["what","how","why","when","where","who","which","whose","can","could","would",
                      "should","is","are","am","was","were","do","does","did","will","tell me","explain",
                      "show","give","list","find","search","help","rank","compare","best","top",
                      "hi","hey","hello","thanks","thank","ok","okay","yes","no","sure"]
        return starts.contains { s == $0 || s.hasPrefix($0 + " ") }
    }
    static func isPersonalFact(_ t: String) -> Bool {
        let s = " " + t.lowercased() + " "
        return ["i ","i'm ","im ","i've ","my ","me ","mine ","myself ","we ","our ","us "]
            .contains { s.contains(" " + $0) || s.contains($0) }
    }
    static func shouldRemember(_ t: String) -> Bool {
        !isQuestion(t) && isPersonalFact(t) && t.split(separator: " ").count >= 4
    }
}

@MainActor
final class ChatViewModel: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var input = ""
    @Published var sending = false
    @Published var faucet: FaucetStatus?
    @Published var models: [OGModel] = []
    @Published var funded: Set<String> = []
    @Published var selectedModel: String?
    @Published var sessions: [ChatSession] = []
    private(set) var activeId = UUID().uuidString

    func loadSessions(token: String) async {
        sessions = (try? await API.sessions(token: token)) ?? []
    }
    func newChat() {
        activeId = UUID().uuidString
        messages = []
    }
    func open(_ s: ChatSession) {
        activeId = s.id
        messages = s.messages
    }
    func delete(_ id: String, token: String) async {
        await API.deleteSession(id: id, token: token)
        sessions.removeAll { $0.id == id }
        if id == activeId { newChat() }
    }
    private func saveCurrent(token: String) async {
        guard !messages.isEmpty else { return }
        let title = messages.first { $0.role == "user" }.map { String($0.content.prefix(40)) } ?? "New chat"
        await API.saveSession(ChatSession(id: activeId, title: title, messages: messages, updatedAt: nil), token: token)
        await loadSessions(token: token)
    }

    func load(token: String) async {
        async let f = try? API.faucetStatus(token: token)
        async let m = try? API.models()
        async let fd = try? API.fundedModels(token: token)
        faucet = await f
        models = await m ?? []
        funded = Set(await fd ?? [])
        if selectedModel == nil {
            // default to a funded ("ready") model so the first chat doesn't have to
            // enable a new one; otherwise the top-ranked model.
            selectedModel = models.first { funded.contains($0.model) }?.model ?? models.first?.model
        }
    }

    func claim(token: String) async {
        if let r = try? await API.claim(token: token), r.ok == true {
            faucet = try? await API.faucetStatus(token: token)
        }
    }

    func send(token: String) async {
        let text = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !sending else { return }
        input = ""
        sending = true
        defer { sending = false }

        messages.append(ChatMessage(role: "user", content: text))
        messages.append(ChatMessage(role: "assistant", content: ""))
        let index = messages.count - 1
        var acc = ""

        do {
            try await API.chat(history: Array(messages.dropLast()), model: selectedModel, token: token) { [weak self] ev in
                guard let self else { return }
                switch ev.type {
                case "meta":
                    if let m = ev.model {
                        self.messages[index].meta = (ev.mode == "live" ? "0G Compute · " : "demo · ") + m
                        // reflect a server-side model fallback in the picker
                        if ev.mode == "live", self.selectedModel != m { self.selectedModel = m }
                    }
                case "delta":
                    if let t = ev.text { acc += t; self.messages[index].content = acc }
                default: break
                }
            }
        } catch {
            messages[index].content += "\n\n_(couldn't reach 0G — try again)_"
        }
        if messages[index].content.isEmpty { messages[index].content = "(no response)" }

        // persist this conversation to chat history
        await saveCurrent(token: token)

        // auto-remember genuine personal facts from the user's message
        if Remember.shouldRemember(text) {
            let facts = await API.extract(text: text, token: token)
            for f in facts where Remember.shouldRemember(f) {
                await API.addMemory(id: UUID().uuidString, text: f, tag: "chat", token: token)
            }
        }
    }
}

struct ChatView: View {
    @EnvironmentObject var auth: AuthManager
    @StateObject private var vm = ChatViewModel()
    @State private var showHistory = false
    private var token: String { auth.token ?? "" }
    private var needsClaim: Bool {
        guard let f = vm.faucet else { return false }
        return (f.enabled ?? false) && !(f.claimed ?? false)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if needsClaim { claimBanner }
                messagesList
                composer
            }
            .navigationTitle("Mirrl")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { showHistory = true } label: { Image(systemName: "clock.arrow.circlepath") }
                }
                ToolbarItem(placement: .topBarLeading) {
                    Button { vm.newChat() } label: { Image(systemName: "square.and.pencil") }
                }
                ToolbarItem(placement: .topBarTrailing) { modelMenu }
            }
            .sheet(isPresented: $showHistory) { historySheet }
            .task {
                await vm.load(token: token)
                await vm.loadSessions(token: token)
                #if DEBUG
                if ProcessInfo.processInfo.arguments.contains("-autoChat"), vm.messages.isEmpty {
                    vm.input = "Give me 3 reasons 0G is great — a short markdown list with a bold heading."
                    await vm.send(token: token)
                }
                #endif
            }
        }
    }

    private var historySheet: some View {
        NavigationStack {
            Group {
                if vm.sessions.isEmpty {
                    ContentUnavailableView("No chats yet", systemImage: "clock",
                                           description: Text("Your conversations will show up here."))
                } else {
                    List {
                        ForEach(vm.sessions) { s in
                            Button {
                                vm.open(s); showHistory = false
                            } label: {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(s.title).lineLimit(1).foregroundStyle(.primary)
                                    Text("\(s.messages.count) messages").font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                        .onDelete { idx in
                            for i in idx { let id = vm.sessions[i].id; Task { await vm.delete(id, token: token) } }
                        }
                    }
                }
            }
            .navigationTitle("Chat history").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Done") { showHistory = false } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { vm.newChat(); showHistory = false } label: { Label("New", systemImage: "square.and.pencil") }
                }
            }
        }
    }

    private var currentModelLabel: String {
        vm.models.first { $0.model == vm.selectedModel }?.label ?? vm.models.first?.label ?? "Model"
    }

    private var modelMenu: some View {
        Menu {
            if vm.models.isEmpty {
                Text("Loading models…")
            } else {
                Picker("Model", selection: $vm.selectedModel) {
                    ForEach(vm.models) { m in
                        Text(m.label + (vm.funded.contains(m.model) ? "  ✓ ready" : ""))
                            .tag(Optional(m.model))
                    }
                }
            }
        } label: {
            HStack(spacing: 4) {
                Circle().fill(vm.selectedModel != nil ? .green : .gray).frame(width: 7, height: 7)
                Text(currentModelLabel).font(.footnote).lineLimit(1)
                Image(systemName: "chevron.down").font(.caption2)
            }.foregroundStyle(.secondary)
        }
    }

    private var claimBanner: some View {
        HStack {
            Image(systemName: "gift.fill")
            Text("Claim 5 free 0G to chat live").font(.subheadline)
            Spacer()
            Button("Claim") { Task { await vm.claim(token: token) } }.font(.subheadline.bold())
        }
        .padding(12)
        .background(LinearGradient(colors: [Color(hex: 0xff5fd2).opacity(0.25), Color(hex: 0x7c5cff).opacity(0.25)],
                                   startPoint: .leading, endPoint: .trailing))
    }

    private var messagesList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 14) {
                    if vm.messages.isEmpty {
                        Text("Ask Mirrl anything — it remembers what matters.")
                            .foregroundStyle(.secondary).padding(.top, 40)
                    }
                    ForEach(vm.messages) { m in bubble(m) }
                }
                .padding().id("bottom")
            }
            .onChange(of: vm.messages.last?.content) { _, _ in
                withAnimation { proxy.scrollTo("bottom", anchor: .bottom) }
            }
        }
    }

    private func bubble(_ m: ChatMessage) -> some View {
        VStack(alignment: m.role == "user" ? .trailing : .leading, spacing: 4) {
            Group {
                if m.role == "assistant" {
                    Text(Markdown.render(m.content.isEmpty ? "…" : m.content))
                } else {
                    Text(m.content.isEmpty ? "…" : m.content)
                }
            }
            .textSelection(.enabled)
            .padding(12)
                .background(m.role == "user" ? Color.white.opacity(0.12) : Color.white.opacity(0.06))
                .clipShape(RoundedRectangle(cornerRadius: 16))
            if let meta = m.meta { Text(meta).font(.caption2).foregroundStyle(.tertiary) }
        }
        .frame(maxWidth: .infinity, alignment: m.role == "user" ? .trailing : .leading)
    }

    private var composer: some View {
        HStack(spacing: 10) {
            TextField("Ask Mirrl…", text: $vm.input, axis: .vertical)
                .textFieldStyle(.plain).padding(12)
                .background(Color.white.opacity(0.06))
                .clipShape(RoundedRectangle(cornerRadius: 20)).lineLimit(1...4)
            Button { Task { await vm.send(token: token) } } label: {
                Image(systemName: "arrow.up.circle.fill").font(.system(size: 32))
                    .foregroundStyle(vm.sending ? .gray : Color(hex: 0x7c5cff))
            }
            .disabled(vm.sending || vm.input.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        .padding()
    }
}
