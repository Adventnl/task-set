import { useEffect, useState } from 'react'

export default function AudioClip({ blob, id }: { blob: Blob; id: string }) {
  const [url, setUrl] = useState('')

  useEffect(() => {
    const nextUrl = URL.createObjectURL(blob)
    setUrl(nextUrl)
    return () => URL.revokeObjectURL(nextUrl)
  }, [blob])

  const extension = blob.type.startsWith('audio/mp4')
    ? 'm4a'
    : blob.type.startsWith('audio/mpeg')
      ? 'mp3'
      : blob.type.startsWith('audio/wav')
        ? 'wav'
        : 'webm'
  return url ? (
    <div className="audio-clip">
      <audio
        className="audio-player"
        controls
        preload="metadata"
        src={url}
        aria-label="Voice recording"
      />
      <a
        className="inline-link"
        href={url}
        download={`task-set-${id}.${extension}`}
      >
        Download recording
      </a>
    </div>
  ) : null
}
