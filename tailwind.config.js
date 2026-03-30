/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0F0F0F',
        'bg-secondary': '#1A1A1E',
        'bg-tertiary': '#252529',
        'accent-amber': '#F59E0B',
        'accent-blue': '#3B82F6',
        'accent-green': '#22C55E',
        'text-primary': '#F5F5F5',
        'text-secondary': '#9CA3AF',
        'text-muted': '#6B7280',
        border: '#2A2A2E',
        steel: '#71717A',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Space Mono"', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        accent: ['"DM Mono"', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-badge': 'bounceBadge 0.4s ease',
        'glow-amber': 'glowAmber 2s ease-in-out infinite',
        'spin-slow': 'spin 8s linear infinite',
      },
      keyframes: {
        bounceBadge: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.4)' },
        },
        glowAmber: {
          '0%, 100%': { boxShadow: '0 0 8px 2px rgba(245,158,11,0.3)' },
          '50%': { boxShadow: '0 0 24px 6px rgba(245,158,11,0.7)' },
        },
      },
    },
  },
  plugins: [],
}
