import Foundation

// Mirrors /api/auth/google response.
struct AuthResponse: Decodable {
    let address: String
    let email: String
    let name: String?
    let picture: String?
    let isNew: Bool
    let token: String // session JWT — stored and sent as Bearer
}

struct MirrlUser: Codable, Equatable {
    let address: String
    let email: String
    let name: String?
    let picture: String?
}

// A chat turn, matching the API's { role, content, meta? } shape.
struct ChatMessage: Codable, Identifiable, Equatable {
    var id = UUID()
    let role: String // "user" | "assistant"
    var content: String
    var meta: String? // e.g. "0G Compute · glm-5.1" (assistant only)

    enum CodingKeys: String, CodingKey { case role, content, meta }
}

// A saved conversation (/api/sessions).
struct ChatSession: Codable, Identifiable {
    let id: String
    var title: String
    var messages: [ChatMessage]
    var updatedAt: Double?
}
struct SessionsResponse: Decodable { let sessions: [ChatSession] }

// One NDJSON event from /api/chat: {type:"meta"|"delta"|"done", ...}
struct ChatEvent: Decodable {
    let type: String
    let text: String?
    let model: String?
    let mode: String? // "live" | "demo"
    let note: String?
}

// /api/faucet GET
struct FaucetStatus: Decodable {
    let signedIn: Bool
    let claimed: Bool?
    let amount: String?
    let enabled: Bool?
}

// /api/faucet POST
struct ClaimResult: Decodable {
    let ok: Bool?
    let txHash: String?
    let amount: String?
    let error: String?
}

// /api/models
struct OGModel: Decodable, Identifiable, Hashable {
    let model: String
    let label: String
    let type: String?
    let rank: Int?
    let note: String?
    var id: String { model }
}
struct ModelsResponse: Decodable { let source: String?; let models: [OGModel] }
struct FundedResponse: Decodable { let funded: [String] }

// /api/memories
struct MemoryItem: Decodable, Identifiable {
    let id: String
    let text: String
    let tag: String
    let createdAt: Double?
    let strength: Double?
    let verified: Bool?
    var tier: String {
        let s = strength ?? 0.5
        return s >= 0.66 ? "durable" : s >= 0.33 ? "active" : "faded"
    }
}
struct MemoriesResponse: Decodable { let memories: [MemoryItem] }
struct ExtractResponse: Decodable { let facts: [String] }

// /api/wallet
struct WalletState: Decodable {
    let native: Double?
    let ledger: Ledger?
    let models: [FundedModel]?
    struct Ledger: Decodable { let total: Double?; let available: Double?; let locked: Double? }
    struct FundedModel: Decodable, Identifiable { let model: String; let balance: Double; var id: String { model } }
}

// /api/memory/status
struct MemoryStatus: Decodable {
    let cached: Int?
    let version: Int?
    let rootHash: String?
    let live: Bool?
}
struct CommitResult: Decodable {
    let committed: Bool?
    let version: Int?
    let rootHash: String?
    let live: Bool?
    let registered: Bool?
    let note: String?
}

// /api/memory/consolidate
struct ConsolidateResult: Decodable {
    let applied: Bool?
    let before: Int?
    let after: Int?
    let foldedAway: Int?
    let pruned: Int?
    let promoted: Int?
}
