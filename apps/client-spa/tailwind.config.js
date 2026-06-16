/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#09090B',
        surface: '#121214',
        card: '#18181B',
        border: '#27272A',
        cyber: {
          cyan:   '#06B6D4',
          purple: '#7C3AED',
          green:  '#10B981',
          red:    '#EF4444',
          amber:  '#F59E0B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Geist Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-cyan': 'glowCyan 2s ease-in-out infinite alternate',
        'scan-line': 'scanLine 2s linear infinite',
        'typewriter': 'typewriter 0.1s steps(1) forwards',
      },
      keyframes: {
        glowCyan: {
          '0%':   { boxShadow: '0 0 5px #06B6D4, 0 0 10px #06B6D4' },
          '100%': { boxShadow: '0 0 20px #06B6D4, 0 0 40px #06B6D4, 0 0 60px #06B6D4' },
        },
        scanLine: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      backgroundImage: {
        'cyber-grid': `
          linear-gradient(rgba(6,182,212,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(6,182,212,0.03) 1px, transparent 1px)
        `,
      },
      backgroundSize: {
        'grid-40': '40px 40px',
      },
    },
  },
  plugins: [],
};
