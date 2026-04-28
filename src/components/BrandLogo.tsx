export const AXIOM_LOGO_SRC = '/brand/axiom-logo-orange.png'
export const AXIOM_FAVICON_SRC = '/brand/axiom-logo-favicon.png'

type BrandLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const sizeClasses: Record<BrandLogoSize, { wrapper: string; mark: string; text: string; subtitle: string }> = {
  xs: {
    wrapper: 'gap-1.5',
    mark: 'h-7 w-7',
    text: 'text-base',
    subtitle: 'text-[9px]',
  },
  sm: {
    wrapper: 'gap-2',
    mark: 'h-9 w-9',
    text: 'text-xl',
    subtitle: 'text-[10px]',
  },
  md: {
    wrapper: 'gap-2.5',
    mark: 'h-11 w-11',
    text: 'text-2xl',
    subtitle: 'text-[11px]',
  },
  lg: {
    wrapper: 'gap-3',
    mark: 'h-14 w-14',
    text: 'text-3xl',
    subtitle: 'text-xs',
  },
  xl: {
    wrapper: 'gap-4',
    mark: 'h-20 w-20',
    text: 'text-4xl',
    subtitle: 'text-sm',
  },
}

type BrandLogoProps = {
  size?: BrandLogoSize
  showWordmark?: boolean
  subtitle?: string
  className?: string
  markClassName?: string
  textClassName?: string
  decorative?: boolean
  loading?: 'eager' | 'lazy'
}

export default function BrandLogo({
  size = 'md',
  showWordmark = true,
  subtitle,
  className = '',
  markClassName = '',
  textClassName = '',
  decorative = false,
  loading = 'eager',
}: BrandLogoProps) {
  const classes = sizeClasses[size]

  return (
    <span
      className={`inline-flex items-center ${classes.wrapper} ${className}`}
      aria-hidden={decorative || undefined}
    >
      <img
        src={AXIOM_LOGO_SRC}
        alt=""
        loading={loading}
        decoding="async"
        className={`${classes.mark} shrink-0 object-contain drop-shadow-[0_0_12px_rgba(245,158,11,0.24)] ${markClassName}`}
      />
      {showWordmark ? (
        <span className="flex min-w-0 flex-col leading-none">
          <span className={`font-mono font-bold tracking-tight text-text-primary ${classes.text} ${textClassName}`}>
            Axiom
          </span>
          {subtitle && (
            <span className={`mt-1 font-mono uppercase tracking-[0.16em] text-text-muted ${classes.subtitle}`}>
              {subtitle}
            </span>
          )}
        </span>
      ) : (
        !decorative && <span className="sr-only">Axiom</span>
      )}
    </span>
  )
}
