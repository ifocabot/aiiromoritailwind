/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./components/**/*.{html,js}",
    "./pages/**/*.{html,js}",
    "./index.html",
    "test.html",
  ],
  theme: {
    screens:{
      sm: '480px',
      md: '768px',
      lg: '1020px',
      xl: '1440px'
    },
    extend :{
    colors :{
      'indigo-blue':'#3748d2',
      'indigo-light': '#Ecedff',
    }
  },
    fontFamily:{
      'primary' : ['"Lato"', 'sans-serif'],
    },

  },
  plugins: [],
};
