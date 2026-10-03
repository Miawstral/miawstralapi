/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    // Follows the system theme.
    darkMode: 'media',
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Geist Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                mono: ['"Geist Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
            },
            fontSize: {
                '2xs': ['0.6875rem', { lineHeight: '1rem' }],
            },
            colors: {
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                surface: 'hsl(var(--surface))',
                subtle: 'hsl(var(--subtle))',
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))',
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))',
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))',
                },
                brand: 'hsl(var(--brand))',
                warning: 'hsl(var(--warning))',
                danger: 'hsl(var(--danger))',
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)',
                xl: 'calc(var(--radius) + 4px)',
                '2xl': 'calc(var(--radius) + 8px)',
            },
            boxShadow: {
                panel: '0 0 0 1px hsl(var(--border)), 0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px -4px rgb(0 0 0 / 0.08), 0 24px 48px -12px rgb(0 0 0 / 0.12)',
                pop: '0 0 0 1px hsl(var(--border)), 0 4px 12px -2px rgb(0 0 0 / 0.08), 0 16px 32px -8px rgb(0 0 0 / 0.16)',
                control: '0 0 0 1px hsl(var(--border)), 0 1px 2px rgb(0 0 0 / 0.06)',
            },
            keyframes: {
                'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
                'rise-in': {
                    from: { opacity: '0', transform: 'translateY(4px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                'slide-in': {
                    from: { opacity: '0', transform: 'translateX(12px)' },
                    to: { opacity: '1', transform: 'translateX(0)' },
                },
                shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
            },
            animation: {
                'fade-in': 'fade-in 150ms ease-out',
                'rise-in': 'rise-in 200ms cubic-bezier(0.2, 0, 0, 1) both',
                'slide-in': 'slide-in 220ms cubic-bezier(0.2, 0, 0, 1)',
                shimmer: 'shimmer 1.6s linear infinite',
            },
        },
    },
    plugins: [],
};
