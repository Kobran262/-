/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        gold: '#C8A96E',
        background: '#0F0F0F',
        content: '#141414',
        surface: '#1C1C1C',
        card: '#1C1C1C',
        border: '#2a2a2a',
        foreground: '#F5F0E8',
        danger: '#E85D4A',
        success: '#5BA85F',
        muted: '#666666',
        'accent-blue': '#378ADD',
      },
    },
  },
  plugins: [],
};
