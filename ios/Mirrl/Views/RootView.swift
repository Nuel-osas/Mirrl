import SwiftUI

// Routes between the sign-in gate and the main tabs once authenticated.
struct RootView: View {
    @EnvironmentObject var auth: AuthManager
    @State private var tab = 0

    var body: some View {
        Group {
            if auth.isSignedIn {
                TabView(selection: $tab) {
                    ChatView().tag(0)
                        .tabItem { Label("Chat", systemImage: "bubble.left.and.bubble.right") }
                    MemoryView().tag(1)
                        .tabItem { Label("Memory", systemImage: "list.bullet.rectangle") }
                    BrainView().tag(2)
                        .tabItem { Label("Brain", systemImage: "brain") }
                    WalletView().tag(3)
                        .tabItem { Label("Wallet", systemImage: "wallet.bifold") }
                }
            } else {
                SignInView()
            }
        }
        .animation(.easeInOut, value: auth.isSignedIn)
        .task {
            #if DEBUG
            let args = ProcessInfo.processInfo.arguments
            if args.contains("-autoDev") { auth.signOut(); await auth.devSignIn() }
            if let i = args.firstIndex(of: "-tab"), i + 1 < args.count { tab = Int(args[i + 1]) ?? 0 }
            #endif
        }
    }
}
