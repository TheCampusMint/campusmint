import AVKit
import SwiftUI

/// The URL is an authorized short-lived server response; credentials are never added to media requests.
struct SecureVideoView: View {
    let url: URL
    @State private var player: AVPlayer?
    var body: some View {
        VideoPlayer(player: player).frame(minHeight: 200)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .onAppear { player = AVPlayer(url: url) }
            .onDisappear { player?.pause(); player = nil }
    }
}
