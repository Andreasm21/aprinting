import { useRef } from 'react'
import '@google/model-viewer'

interface ModelViewerProps {
  src: string
  alt?: string
  className?: string
  autoRotate?: boolean
}

export default function ModelViewer({
  src,
  alt = '3D Model',
  className = '',
  autoRotate = true,
}: ModelViewerProps) {
  const ref = useRef<HTMLElement>(null)

  return (
    <model-viewer
      ref={ref}
      src={src}
      alt={alt}
      auto-rotate={autoRotate ? '' : undefined}
      camera-controls=""
      shadow-intensity="0.5"
      exposure="0.8"
      loading="lazy"
      className={`w-full h-full block ${className}`}
      style={{
        ['--poster-color' as string]: 'transparent',
        backgroundColor: 'transparent',
      }}
    />
  )
}
