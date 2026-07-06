import SwiftUI

struct SignInView: View {
    @EnvironmentObject var auth: AuthManager

    var body: some View {
        VStack(spacing: 20) {
            Spacer()

            // brand mark
            RoundedRectangle(cornerRadius: 20)
                .fill(LinearGradient(colors: [Color(hex: 0xff5fd2), Color(hex: 0x7c5cff)],
                                     startPoint: .topLeading, endPoint: .bottomTrailing))
                .frame(width: 72, height: 72)
                .overlay(Image(systemName: "brain.head.profile").font(.system(size: 32)).foregroundStyle(.white))

            Text("Mirrl").font(.largeTitle.bold())
            Text("A personal AI whose memory you own.")
                .font(.subheadline).foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Spacer()

            Button {
                Task { await auth.signIn() }
            } label: {
                HStack {
                    if auth.signingIn { ProgressView().tint(.white) }
                    else { Image(systemName: "person.crop.circle") }
                    Text(auth.signingIn ? "Signing in…" : "Continue with Google")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(LinearGradient(colors: [Color(hex: 0xff5fd2), Color(hex: 0x7c5cff)],
                                           startPoint: .leading, endPoint: .trailing))
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .disabled(auth.signingIn)

            Text("We create a private 0G wallet for you automatically.")
                .font(.caption2).foregroundStyle(.tertiary)

            #if DEBUG
            Button("Dev sign-in (simulator)") { Task { await auth.devSignIn() } }
                .font(.caption).foregroundStyle(.secondary).padding(.top, 4)
            #endif

            if let error = auth.error {
                Text(error).font(.caption).foregroundStyle(.red).multilineTextAlignment(.center)
            }
        }
        .padding(24)
    }
}

extension Color {
    init(hex: UInt) {
        self.init(red: Double((hex >> 16) & 0xff) / 255,
                  green: Double((hex >> 8) & 0xff) / 255,
                  blue: Double(hex & 0xff) / 255)
    }
}
