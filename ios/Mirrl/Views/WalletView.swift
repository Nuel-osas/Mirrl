import SwiftUI

@MainActor
final class WalletViewModel: ObservableObject {
    @Published var state: WalletState?
    @Published var faucet: FaucetStatus?
    @Published var loading = false
    @Published var claiming = false

    func load(token: String) async {
        loading = true; defer { loading = false }
        state = try? await API.wallet(token: token)
        faucet = try? await API.faucetStatus(token: token)
    }
    func claim(token: String) async {
        claiming = true; defer { claiming = false }
        if let r = try? await API.claim(token: token), r.ok == true {
            await load(token: token)
        }
    }
    @Published var reclaiming = false
    func reclaim(token: String) async {
        reclaiming = true; defer { reclaiming = false }
        try? await API.reclaim(token: token)
        await load(token: token)
    }
}

struct WalletView: View {
    @EnvironmentObject var auth: AuthManager
    @StateObject private var vm = WalletViewModel()
    private var token: String { auth.token ?? "" }
    private var fmt: (Double?) -> String { { String(format: "%.4f", $0 ?? 0) } }

    var body: some View {
        NavigationStack {
            List {
                Section("Your 0G wallet") {
                    if let addr = auth.user?.address, !addr.isEmpty {
                        Button {
                            UIPasteboard.general.string = addr
                        } label: {
                            HStack {
                                Text(short(addr)).font(.system(.footnote, design: .monospaced))
                                Spacer(); Image(systemName: "doc.on.doc").font(.caption)
                            }
                        }
                    }
                    if let email = auth.user?.email, !email.isEmpty {
                        LabeledContent("Account", value: email)
                    }
                }

                Section("Balances") {
                    LabeledContent("Wallet (spendable)", value: "\(fmt(vm.state?.native)) 0G")
                    LabeledContent("Ledger available", value: "\(fmt(vm.state?.ledger?.available)) 0G")
                    LabeledContent("Locked in models", value: "\(fmt(vm.state?.ledger?.locked)) 0G")
                }

                if let models = vm.state?.models, !models.isEmpty {
                    Section("Funded models") {
                        ForEach(models) { m in
                            LabeledContent(m.model, value: "\(fmt(m.balance)) 0G")
                        }
                    }
                    if (vm.state?.ledger?.locked ?? 0) > 0 {
                        Section {
                            Button {
                                Task { await vm.reclaim(token: token) }
                            } label: {
                                HStack {
                                    if vm.reclaiming { ProgressView() } else { Image(systemName: "arrow.down.to.line") }
                                    Text("Reclaim all 0G from models")
                                }
                            }
                        } footer: {
                            Text("Pulls every model's 0G back to your main balance. 0G time-locks reclaimed funds briefly.")
                        }
                    }
                }

                if let f = vm.faucet, (f.enabled ?? false), !(f.claimed ?? false) {
                    Section {
                        Button {
                            Task { await vm.claim(token: token) }
                        } label: {
                            HStack {
                                if vm.claiming { ProgressView() } else { Image(systemName: "gift.fill") }
                                Text("Claim \(f.amount ?? "5") 0G to go live")
                            }
                        }
                    } footer: {
                        Text("Funds a private 0G wallet that pays for your inference. You own it.")
                    }
                }

                Section {
                    Button(role: .destructive) { auth.signOut() } label: {
                        Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                }
            }
            .navigationTitle("Wallet")
            .refreshable { await vm.load(token: token) }
            .task { await vm.load(token: token) }
            .overlay { if vm.loading && vm.state == nil { ProgressView() } }
        }
    }

    private func short(_ a: String) -> String {
        a.count > 12 ? "\(a.prefix(6))…\(a.suffix(4))" : a
    }
}
