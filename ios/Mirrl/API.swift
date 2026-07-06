import Foundation

enum APIError: Error { case badStatus(Int, String), decode }

// Thin client over the existing Mirrl backend. All authenticated calls send the
// session JWT as `Authorization: Bearer` (issued by /api/auth/google).
enum API {
    private static func request(_ path: String, method: String = "GET", token: String? = nil, body: Encodable? = nil) throws -> URLRequest {
        // Build the URL by string, NOT URL.appending(path:) — that percent-encodes
        // the "?" and breaks every query string (models, funded, wallet).
        let base = Config.apiBase.absoluteString
        guard let url = URL(string: base.hasSuffix("/") ? base + path : base + "/" + path) else {
            throw APIError.badStatus(-1, "bad url")
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body { req.httpBody = try JSONEncoder().encode(AnyEncodable(body)) }
        return req
    }

    // MARK: Auth
    static func signIn(idToken: String) async throws -> AuthResponse {
        let req = try request("api/auth/google", method: "POST", body: ["idToken": idToken])
        let (data, resp) = try await URLSession.shared.data(for: req)
        try check(resp, data)
        return try JSONDecoder().decode(AuthResponse.self, from: data)
    }

    // MARK: Faucet
    static func faucetStatus(token: String) async throws -> FaucetStatus {
        let req = try request("api/faucet", token: token)
        let (data, resp) = try await URLSession.shared.data(for: req)
        try check(resp, data)
        return try JSONDecoder().decode(FaucetStatus.self, from: data)
    }

    static func claim(token: String) async throws -> ClaimResult {
        let req = try request("api/faucet", method: "POST", token: token)
        let (data, _) = try await URLSession.shared.data(for: req)
        return try JSONDecoder().decode(ClaimResult.self, from: data)
    }

    // MARK: Models
    static func models(network: String = Config.network) async throws -> [OGModel] {
        let req = try request("api/models?network=\(network)")
        let (data, _) = try await URLSession.shared.data(for: req)
        return (try? JSONDecoder().decode(ModelsResponse.self, from: data))?.models ?? []
    }
    static func fundedModels(token: String, network: String = Config.network) async throws -> [String] {
        let req = try request("api/models/funded?network=\(network)", token: token)
        let (data, _) = try await URLSession.shared.data(for: req)
        return (try? JSONDecoder().decode(FundedResponse.self, from: data))?.funded ?? []
    }

    // MARK: Memory
    static func memories(token: String) async throws -> [MemoryItem] {
        let req = try request("api/memories", token: token)
        let (data, _) = try await URLSession.shared.data(for: req)
        return (try? JSONDecoder().decode(MemoriesResponse.self, from: data))?.memories ?? []
    }
    static func addMemory(id: String, text: String, tag: String, token: String) async {
        guard let req = try? request("api/memories", method: "POST", token: token,
                                     body: ["id": id, "text": text, "tag": tag]) else { return }
        _ = try? await URLSession.shared.data(for: req)
    }
    static func extract(text: String, token: String) async -> [String] {
        guard let req = try? request("api/extract", method: "POST", token: token, body: ["text": text]),
              let (data, _) = try? await URLSession.shared.data(for: req) else { return [] }
        return (try? JSONDecoder().decode(ExtractResponse.self, from: data))?.facts ?? []
    }
    static func memoryStatus(token: String) async throws -> MemoryStatus {
        let req = try request("api/memory/status", token: token)
        let (data, _) = try await URLSession.shared.data(for: req)
        return try JSONDecoder().decode(MemoryStatus.self, from: data)
    }
    static func commitMemory(token: String, network: String = Config.network) async throws -> CommitResult {
        let req = try request("api/memory/commit", method: "POST", token: token, body: ["network": network])
        let (data, _) = try await URLSession.shared.data(for: req)
        return try JSONDecoder().decode(CommitResult.self, from: data)
    }

    static func consolidate(apply: Bool, token: String) async throws -> ConsolidateResult {
        let req = try request("api/memory/consolidate", method: "POST", token: token, body: ["apply": apply])
        let (data, _) = try await URLSession.shared.data(for: req)
        return try JSONDecoder().decode(ConsolidateResult.self, from: data)
    }

    // MARK: Wallet
    static func wallet(token: String, network: String = Config.network) async throws -> WalletState {
        let req = try request("api/wallet?net=\(network)", token: token)
        let (data, _) = try await URLSession.shared.data(for: req)
        return try JSONDecoder().decode(WalletState.self, from: data)
    }
    static func reclaim(token: String, network: String = Config.network) async throws {
        let req = try request("api/wallet?net=\(network)", method: "POST", token: token)
        _ = try await URLSession.shared.data(for: req)
    }

    // MARK: Chat sessions
    static func sessions(token: String) async throws -> [ChatSession] {
        let req = try request("api/sessions", token: token)
        let (data, _) = try await URLSession.shared.data(for: req)
        return (try? JSONDecoder().decode(SessionsResponse.self, from: data))?.sessions ?? []
    }
    static func saveSession(_ s: ChatSession, token: String) async {
        struct Body: Encodable { let id: String; let title: String; let messages: [ChatMessage] }
        guard let req = try? request("api/sessions", method: "POST", token: token,
                                     body: Body(id: s.id, title: s.title, messages: s.messages)) else { return }
        _ = try? await URLSession.shared.data(for: req)
    }
    static func deleteSession(id: String, token: String) async {
        guard let req = try? request("api/sessions?id=\(id)", method: "DELETE", token: token) else { return }
        _ = try? await URLSession.shared.data(for: req)
    }

    // MARK: Chat (streaming NDJSON)
    struct ChatBody: Encodable { let messages: [Wire]; let model: String?; let network: String
        struct Wire: Encodable { let role: String; let content: String }
    }

    /// Streams the assistant reply. `onEvent` fires on the main actor for each
    /// {type:"meta"|"delta"|"done"} line as it arrives.
    static func chat(history: [ChatMessage], model: String?, token: String,
                     onEvent: @escaping @MainActor (ChatEvent) -> Void) async throws {
        let wire = history.map { ChatBody.Wire(role: $0.role, content: $0.content) }
        var req = try request("api/chat", method: "POST", token: token,
                              body: ChatBody(messages: wire, model: model, network: Config.network))
        req.timeoutInterval = 120
        let (bytes, resp) = try await URLSession.shared.bytes(for: req)
        if let http = resp as? HTTPURLResponse, http.statusCode >= 400 {
            throw APIError.badStatus(http.statusCode, "")
        }
        for try await line in bytes.lines {
            guard let data = line.data(using: .utf8),
                  let ev = try? JSONDecoder().decode(ChatEvent.self, from: data) else { continue }
            await onEvent(ev)
        }
    }

    // MARK: helpers
    private static func check(_ resp: URLResponse, _ data: Data) throws {
        if let http = resp as? HTTPURLResponse, http.statusCode >= 400 {
            throw APIError.badStatus(http.statusCode, String(data: data, encoding: .utf8) ?? "")
        }
    }
}

// Lets us pass a heterogeneous Encodable body.
struct AnyEncodable: Encodable {
    private let encodeFn: (Encoder) throws -> Void
    init(_ wrapped: Encodable) { encodeFn = wrapped.encode }
    func encode(to encoder: Encoder) throws { try encodeFn(encoder) }
}
