import 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string
          alt?: string
          poster?: string
          'auto-rotate'?: boolean | string
          'camera-controls'?: boolean | string
          'shadow-intensity'?: string
          'environment-image'?: string
          'exposure'?: string
          'tone-mapping'?: string
          'loading'?: string
          'reveal'?: string
          'ar'?: boolean | string
        },
        HTMLElement
      >
    }
  }
}
