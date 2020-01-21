module.exports = {
  theme: {
    fontFamily: {
      sans: ['Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      serif: ['Roboto Slab', 'sans-serif'],
      hero: ['Roboto', 'sans-serif']
    },
    container: {
      center: true
    },
    screens: {
      sm: '640px',
      // => @media (min-width: 640px) { ... }

      md: '768px',
      // => @media (min-width: 768px) { ... }

      lg: '1024px'
      // => @media (min-width: 1024px) { ... }
    },
    extend: {}
  },
  variants: {},
  plugins: [
    require('tailwindcss-grid')({
      grids: [2, 3, 5, 6, 8, 10, 12],
      gaps: {
        0: '0',
        4: '1rem',
        8: '2rem',
        '4-x': '1rem',
        '4-y': '1rem'
      },
      autoMinWidths: {
        '16': '4rem',
        '24': '6rem',
        '500px': '500px',
        '300px': '300px'
      },
      variants: ['responsive']
    })
  ]
}
