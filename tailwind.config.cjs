const defaultTheme = require('tailwindcss/defaultTheme')

module.exports = {
  content: ["./index.html","./src/**/*.{svelte,js,ts}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        win: '#16A34A',
        loss: '#EF4444',
        neutral: '#D1D5DB',
        background: '#F9FAFB',
        accent: '#2563EB',
      },
      borderRadius: {
        'xl': '0.875rem',
      }
    },
  },
  plugins: [],
};
