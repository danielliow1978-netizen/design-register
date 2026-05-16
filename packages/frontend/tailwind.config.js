/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Map CSS vars to Tailwind utilities
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        text: 'var(--text)',
        'text-2': 'var(--text-2)',
        'text-3': 'var(--text-3)',
        'info-bg': 'var(--info-bg)',
        'info-text': 'var(--info-text)',
        'info-border': 'var(--info-border)',
        'success-bg': 'var(--success-bg)',
        'success-text': 'var(--success-text)',
        'success-border': 'var(--success-border)',
        'danger-bg': 'var(--danger-bg)',
        'danger-text': 'var(--danger-text)',
        'danger-border': 'var(--danger-border)',
        'warning-bg': 'var(--warning-bg)',
        'warning-text': 'var(--warning-text)',
        'warning-border': 'var(--warning-border)',
        'purple-bg': 'var(--purple-bg)',
        'purple-text': 'var(--purple-text)',
        'teal-bg': 'var(--teal-bg)',
        'teal-text': 'var(--teal-text)',
      },
      borderRadius: {
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
