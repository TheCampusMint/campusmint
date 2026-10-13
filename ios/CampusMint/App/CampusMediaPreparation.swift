import Foundation
import CoreTransferable
import UniformTypeIdentifiers
import ImageIO
import AVFoundation
import CampusMintCore

struct PickedCampusMedia: Transferable, Sendable {
    let url: URL
    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(importedContentType: .data) { received in
            let size = try received.file.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
            guard size > 0, size <= 500 * 1024 * 1024 else { throw CampusError.invalidPost("Choose a smaller file, under 500 MB.") }
            let target = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension(received.file.pathExtension)
            try FileManager.default.copyItem(at: received.file, to: target)
            try FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: target.path)
            return Self(url: target)
        }
    }
}

enum CampusMediaPreparation {
    static func prepare(_ source: URL, video: Bool, highQuality: Bool, directory: URL) async throws -> UploadMedia {
        let id = UUID()
        let target = directory.appendingPathComponent(id.uuidString.lowercased()).appendingPathExtension(video ? "mp4" : "jpg")
        defer { try? FileManager.default.removeItem(at: source) }
        do {
            let result: UploadMedia
            if video {
                let asset = AVURLAsset(url: source)
                let tracks = try await asset.loadTracks(withMediaType: .video)
                guard !tracks.isEmpty else { throw CampusError.invalidPost("This video could not be opened.") }
                let duration = try await asset.load(.duration).seconds
                guard duration.isFinite, duration > 0 else { throw CampusError.invalidPost("This video could not be opened.") }
                let preset = highQuality ? AVAssetExportPreset3840x2160 : AVAssetExportPreset1920x1080
                guard let exporter = AVAssetExportSession(asset: asset, presetName: preset) else { throw CampusError.invalidPost("This video format is not supported.") }
                exporter.outputURL = target; exporter.outputFileType = .mp4
                exporter.shouldOptimizeForNetworkUse = true
                exporter.metadata = []
                await exporter.export()
                guard exporter.status == .completed else { throw CampusError.invalidPost("Couldn’t prepare the video. Try another clip.") }
                let output = AVURLAsset(url: target)
                guard let outputTrack = try await output.loadTracks(withMediaType: .video).first else { throw CampusError.invalidResponse }
                let outputSize = try await outputTrack.load(.naturalSize)
                let outputTransform = try await outputTrack.load(.preferredTransform)
                let dimensions = outputSize.applying(outputTransform)
                guard dimensions.width.isFinite, dimensions.height.isFinite else { throw CampusError.invalidResponse }
                result = UploadMedia(id: id, mimeType: "video/mp4", byteSize: try fileSize(target), width: max(1, Int(abs(dimensions.width))), height: max(1, Int(abs(dimensions.height))), durationSeconds: duration)
            } else {
                guard let imageSource = CGImageSourceCreateWithURL(source as CFURL, nil) else { throw CampusError.invalidPost("This photo could not be opened.") }
                if CGImageSourceGetType(imageSource) as String? == UTType.gif.identifier { throw CampusError.invalidPost("Animated GIF uploads are not available here yet.") }
                let properties = CGImageSourceCopyPropertiesAtIndex(imageSource, 0, nil) as? [CFString: Any]
                let sourceWidth = (properties?[kCGImagePropertyPixelWidth] as? NSNumber)?.intValue ?? 0
                let sourceHeight = (properties?[kCGImagePropertyPixelHeight] as? NSNumber)?.intValue ?? 0
                guard sourceWidth > 0, sourceHeight > 0 else { throw CampusError.invalidPost("This photo could not be opened.") }
                let longestEdge = min(highQuality ? 3840 : 2048, max(sourceWidth, sourceHeight))
                guard let image = CGImageSourceCreateThumbnailAtIndex(imageSource, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true, kCGImageSourceThumbnailMaxPixelSize: longestEdge, kCGImageSourceShouldCacheImmediately: true] as CFDictionary),
                      let destination = CGImageDestinationCreateWithURL(target as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else { throw CampusError.invalidPost("This photo could not be opened.") }
                // Re-encode pixels only: original GPS and other EXIF metadata are not copied.
                CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: highQuality ? 0.94 : 0.86] as CFDictionary)
                guard CGImageDestinationFinalize(destination) else { throw CampusError.invalidPost("Couldn’t prepare the photo.") }
                result = UploadMedia(id: id, mimeType: "image/jpeg", byteSize: try fileSize(target), width: image.width, height: image.height)
            }
            try UploadMedia.validate([result])
            try FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: target.path)
            var protectedURL = target; var values = URLResourceValues(); values.isExcludedFromBackup = true
            try protectedURL.setResourceValues(values)
            return result
        } catch { try? FileManager.default.removeItem(at: target); throw error }
    }
    private static func fileSize(_ url: URL) throws -> Int { try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0 }
}
