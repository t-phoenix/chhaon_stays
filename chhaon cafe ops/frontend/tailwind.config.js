/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Caveat', 'cursive'],
        sans: ['Figtree', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Chhaon brand
        bone: '#F9F6F0',
        cream: '#F1ECE1',
        oat: '#E6DFD3',
        sage: {
          DEFAULT: '#8A9A86',
          dark: '#788774',
          light: '#B6C3B3',
          50: '#F2F5F1',
        },
        tan: {
          DEFAULT: '#B88A6B',
          dark: '#A5795C',
          light: '#D6B79B',
        },
        ink: '#2D372B',
        ink2: '#5C665A',
        // status palette
        statusNew: '#D96C6C',
        statusPrep: '#E6A15C',
        statusReady: '#7B9E73',
        statusServed: '#A3A8A1',
        // shadcn (mapped to brand)
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      boxShadow: {
        soft: '0 4px 20px rgba(138,154,134,0.08)',
        floating: '0 8px 30px rgba(184,138,107,0.15)',
        cardHover: '0 8px 25px rgba(138,154,134,0.12)',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        'pop-in': {
          '0%': { transform: 'scale(0.6)', opacity: '0' },
          '70%': { transform: 'scale(1.08)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'fade-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'pop-in': 'pop-in 380ms cubic-bezier(.2,.8,.2,1.2)',
        'fade-up': 'fade-up 320ms ease-out',
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
};
