import AVKit
import SwiftUI

/// Signed media URLs carry no account credentials. Playback stops offscreen or in the background.
struct SecureVideoView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.scenePhase) private var phase
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    let url: URL
    @State private var player: AVPlayer?
    @State private var visible = false
    private var autoplay: Bool { visible && phase == .active && model.autoplayVideo && !model.reduceMotion && !systemReduceMotion }
    var body: some View {
        VideoPlayer(player: player).frame(minHeight: 200)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .modifier(CampusVisibleOnScreen(visible: $visible))
            .onAppear { player = AVPlayer(url: url); player?.isMuted = model.autoplayVideo; if autoplay { player?.play() } }
            .onChange(of: autoplay) { _, enabled in if enabled { player?.isMuted = true; player?.play() } else { player?.pause() } }
            .onChange(of: visible) { _, value in if !value { player?.pause() } }
            .onChange(of: phase) { _, value in if value != .active { player?.pause() } }
            .onChange(of: url) { old, new in
                let time = player?.currentTime() ?? .zero
                let resume = player?.rate != 0 && visible && phase == .active
                player?.replaceCurrentItem(with: AVPlayerItem(url: new))
                if old.path == new.path { player?.seek(to: time) }
                if resume { player?.play() }
            }
            .onDisappear { player?.pause(); player = nil }
    }
}
