import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}','./components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:'#EEF7FF',
          100:'#D8ECFF',
          200:'#BADBFF',
          300:'#8EC4FF',
          400:'#5AA9F7',
          500:'#2D8FE8',
          600:'#0E7BD0', // dùng nhiều
          700:'#0B66AA', // hover
          800:'#0D5186',
          900:'#0E436F',
          // Giữ các key cũ để không phá chỗ đã dùng:
          primary: '#0ea44b',
          secondary: '#f5c518',
          accent: '#0ea5e9',
          muted: '#6b7280',
          neutral: '#111827',
        },
      },
      boxShadow: { soft: '0 8px 24px rgba(0,0,0,0.08)' },
      borderRadius: { '2xl': '1rem' },
    },
  },
  plugins: [],
}
export default config
