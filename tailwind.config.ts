
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}','./components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#0ea44b',
          secondary: '#f5c518',
          accent: '#0ea5e9',
          muted: '#6b7280',
          neutral: '#111827',
        }
      },
      boxShadow: {
        soft: '0 8px 24px rgba(0,0,0,0.08)'
      },
      borderRadius: {
        '2xl': '1rem'
      }
    }
  },
  plugins: [],
}
export default config
