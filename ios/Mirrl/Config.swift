import Foundation

// App-wide configuration. Update these two values for your setup.
enum Config {
    /// Base URL of the Mirrl backend (the same Next.js API the web uses).
    /// Simulator → local dev server; device/prod → the public URL.
    #if targetEnvironment(simulator)
    static let apiBase = URL(string: "http://localhost:3000")!
    #else
    static let apiBase = URL(string: "https://mirrl.xyz")!
    #endif

    /// iOS OAuth client ID — read from Info.plist (GIDClientID) so it's set in one
    /// place. Create it in Google Cloud (Credentials → iOS client, bundle id below).
    static var googleClientID: String {
        (Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String) ?? ""
    }

    /// 0G network the app runs against.
    static let network = "mainnet"
}
