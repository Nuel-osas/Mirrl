# Mirrl iOS (SwiftUI) — Chat MVP

A native iOS client for Mirrl. It talks to the **existing** Next.js backend
(`mirrl.xyz`) — no second backend. Auth via Google → the app receives the session
JWT and sends it as `Authorization: Bearer`.

**MVP scope:** Sign in with Google → claim 5 0G → live streaming chat that remembers.

## Files (drag into your Xcode project's target)
```
Config.swift        – API base URL + Google iOS client ID (EDIT THESE)
Models.swift        – Codable types matching the API
Keychain.swift      – stores the session JWT
API.swift           – client: signIn, faucet, chat (streaming via URLSession.bytes)
AuthManager.swift   – auth state + GoogleSignIn
MirrlApp.swift       – @main entry (handles the Google redirect)
Views/RootView.swift    – routes sign-in ↔ chat
Views/SignInView.swift  – Continue with Google
Views/ChatView.swift    – the chat + claim banner (hero)
```

## 1. Create the Xcode project
- Xcode → New → App → **SwiftUI**, name `Mirrl`, min iOS **17**.
- Delete the generated `ContentView.swift` and the default `App` file.
- Drag the files above into the project (check "Copy items", add to the `Mirrl` target).

## 2. Add GoogleSignIn-iOS (Swift Package Manager)
- File → Add Package Dependencies → `https://github.com/google/GoogleSignIn-iOS`
- Add the **GoogleSignIn** product to the app target.

## 3. Create the iOS OAuth client (Google Cloud)
- Google Cloud Console → your existing project → APIs & Services → Credentials.
- Create Credentials → OAuth client ID → **iOS**.
- **Bundle ID:** use your app's (e.g. `com.mirrl.app`) — must match Xcode's.
- Copy the **iOS client ID** (`...apps.googleusercontent.com`).

## 4. Configure the app
- **`Config.swift`**:
  - `googleClientID` = the iOS client ID from step 3.
  - `apiBase` = `https://mirrl.xyz` (or `http://localhost:3000` for the simulator against a local `npm run dev`).
- **Info.plist** → add a URL scheme = your client ID **reversed**
  (`com.googleusercontent.apps.XXXX`). In Xcode: target → Info → URL Types → add,
  URL Schemes = that reversed string.
- (Optional) add `GIDClientID` = the client ID under Info.plist too.

## 5. Run
- Pick an iOS 17 simulator → Run.
- Continue with Google → you get a custodial 0G wallet → Claim 5 0G → chat live.

> The backend must be reachable. `mirrl.xyz` works from a device; for a local
> backend use `http://localhost:3000` **and** allow arbitrary loads in Info.plist
> (App Transport Security) while developing.

## 6. TestFlight
1. Set the **bundle id** + your **Team** (Signing & Capabilities → automatic signing).
2. App Store Connect → create the app record (same bundle id).
3. Xcode → **Product → Archive** → Distribute App → **App Store Connect** → Upload.
4. App Store Connect → TestFlight:
   - **Internal testers** (up to 100 on your team): available in minutes.
   - **External testers:** submit for a short **beta review** (~1 day), then share a public link.
5. Add an app icon (Assets) before archiving.

## Notes / next builds
- The backend already returns the JWT in `/api/auth/google` and accepts
  `Authorization: Bearer` in `readSession()` — web keeps using cookies.
- Streaming uses `URLSession.bytes(for:)` — native, no polyfill.
- Next screens to port: **Memories** (tiers), **Brain** (graph), **Wallet/funding**.
