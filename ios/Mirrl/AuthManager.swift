import Foundation
import SwiftUI
import UIKit
#if canImport(GoogleSignIn)
import GoogleSignIn
#endif

// Owns auth state: the session JWT (in Keychain) + the signed-in user.
@MainActor
final class AuthManager: ObservableObject {
    @Published var user: MirrlUser?
    @Published var signingIn = false
    @Published var error: String?

    private(set) var token: String?

    private let userKey = "mirrl.user"

    init() {
        // restore a persisted session + profile on launch
        if let t = Keychain.read() {
            token = t
            if let data = UserDefaults.standard.data(forKey: userKey),
               let u = try? JSONDecoder().decode(MirrlUser.self, from: data) {
                user = u
            } else {
                user = MirrlUser(address: "", email: "", name: nil, picture: nil)
            }
        }
    }

    var isSignedIn: Bool { token != nil }

    func signIn() async {
        #if canImport(GoogleSignIn)
        signingIn = true
        error = nil
        defer { signingIn = false }
        do {
            guard let root = Self.rootViewController() else { throw AuthError.noWindow }
            GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: Config.googleClientID)
            let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: root)
            guard let idToken = result.user.idToken?.tokenString else { throw AuthError.noIDToken }
            try await finish(API.signIn(idToken: idToken))
        } catch {
            self.error = (error as? AuthError)?.message ?? error.localizedDescription
        }
        #else
        // GoogleSignIn not linked (simulator smoke build) → use the dev path.
        await devSignIn()
        #endif
    }

    /// DEBUG/simulator: authenticate without Google via the dev endpoint.
    func devSignIn() async {
        signingIn = true
        error = nil
        defer { signingIn = false }
        do {
            var req = URLRequest(url: Config.apiBase.appending(path: "api/auth/dev"))
            req.httpMethod = "POST"
            let (data, resp) = try await URLSession.shared.data(for: req)
            if let http = resp as? HTTPURLResponse, http.statusCode >= 400 {
                throw AuthError.dev(String(data: data, encoding: .utf8) ?? "dev sign-in failed")
            }
            try await finish(JSONDecoder().decode(AuthResponse.self, from: data))
        } catch {
            self.error = (error as? AuthError)?.message ?? error.localizedDescription
        }
    }

    private func finish(_ auth: AuthResponse) async throws {
        Keychain.save(auth.token)
        token = auth.token
        let u = MirrlUser(address: auth.address, email: auth.email, name: auth.name, picture: auth.picture)
        user = u
        if let data = try? JSONEncoder().encode(u) { UserDefaults.standard.set(data, forKey: userKey) }
    }

    func signOut() {
        #if canImport(GoogleSignIn)
        GIDSignIn.sharedInstance.signOut()
        #endif
        Keychain.clear()
        UserDefaults.standard.removeObject(forKey: userKey)
        token = nil
        user = nil
    }

    // Find the top view controller to present Google's sheet from.
    static func rootViewController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes.first { $0.activationState == .foregroundActive } as? UIWindowScene
        var top = scene?.keyWindow?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
}

enum AuthError: Error {
    case noWindow, noIDToken
    case dev(String)
    var message: String {
        switch self {
        case .noWindow: return "Couldn't present sign-in."
        case .noIDToken: return "Google didn't return an ID token."
        case .dev(let m): return m
        }
    }
}

private extension UIWindowScene {
    var keyWindow: UIWindow? { windows.first { $0.isKeyWindow } ?? windows.first }
}
