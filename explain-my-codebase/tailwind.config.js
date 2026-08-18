/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0B0D12',
          50: '#F4F5F7',
          panel: '#12151D',
          panelAlt: '#181C26',
          border: '#232838',
          borderSoft: '#1B1F2B',
        },
        add: {
          DEFAULT: '#4ADE80',
          dim: '#1F3B2B',
          bg: '#0F2119',
        },
        del: {
          DEFAULT: '#F5A623',
          dim: '#3A2E17',
        },
        signal: {
          DEFAULT: '#7C9CFF',
          soft: '#2A3352',
        },
        text: {
          primary: '#E7E9F0',
          muted: '#8B90A3',
          faint: '#565C6F',
        },
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(124,156,255,0.15), 0 8px 30px rgba(124,156,255,0.08)',
      },
      keyframes: {
        blink: {
          '0%, 49%': { opacity: 1 },
          '50%, 100%': { opacity: 0 },
        },
        typeline: {
          from: { width: '0%' },
          to: { width: '100%' },
        },
        fadeUp: {
          from: { opacity: 0, transform: 'translateY(8px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      },
      animation: {
        blink: 'blink 1s step-start infinite',
        fadeUp: 'fadeUp 0.5s ease-out both',
      },
    },
  },
  plugins: [],
}
