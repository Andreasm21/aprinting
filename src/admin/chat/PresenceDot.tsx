// Tiny status dot — green = online, grey = offline.

interface Props {
  online: boolean
  size?: number
  className?: string
}

export default function PresenceDot({ online, size = 8, className = '' }: Props) {
  return (
    <span
      aria-label={online ? 'online' : 'offline'}
      className={`inline-block rounded-full ${
        online ? 'bg-emerald-500 ring-2 ring-emerald-500/30' : 'bg-text-muted/40'
      } ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
