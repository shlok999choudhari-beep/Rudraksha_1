import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

/**
 * VeriGuard AI design tokens.
 *
 * Two deliberate colour families exist and must not be mixed:
 *   `rule.*`   -> deterministic / rule-based validation output (sky)
 *   `ai.*`     -> probabilistic / forensic model output (violet)
 * See the "Separate AI and Rules" requirement in the frontend spec.
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    /**
     * Tailwind's default opacity scale is coarse (5, 10, 20, 30 …) and silently
     * drops any class using a step it does not know — `bg-risk-high/12` would
     * compile to nothing at all. Tinted evidence panels need finer control than
     * that, so every whole percent is available.
     */
    opacity: Object.fromEntries(
      Array.from({ length: 101 }, (_, index) => [String(index), String(index / 100)]),
    ),
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1600px' },
    },
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          muted: 'hsl(var(--surface-muted))',
          raised: 'hsl(var(--surface-raised))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          muted: 'hsl(var(--primary-muted))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        'border-strong': 'hsl(var(--border-strong))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',

        // Risk semantics — the single source of truth for LOW / MEDIUM / HIGH.
        risk: {
          low: 'hsl(var(--risk-low))',
          medium: 'hsl(var(--risk-medium))',
          high: 'hsl(var(--risk-high))',
          unknown: 'hsl(var(--risk-unknown))',
        },
        // Deterministic rule engine signals.
        rule: {
          DEFAULT: 'hsl(var(--rule))',
          soft: 'hsl(var(--rule-soft))',
        },
        // Probabilistic / AI forensic signals.
        ai: {
          DEFAULT: 'hsl(var(--ai))',
          soft: 'hsl(var(--ai-soft))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.04em' }],
      },
      // Half-steps for icon sizing between Tailwind's 4 and 5.
      spacing: {
        '4.5': '1.125rem',
        '5.5': '1.375rem',
      },
      boxShadow: {
        panel: '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
        glow: '0 0 0 1px hsl(var(--border-strong)), 0 4px 12px -2px rgba(0, 0, 0, 0.06)',
        'glow-high': '0 0 0 1px hsl(var(--risk-high) / 0.35)',
        'glow-low': '0 0 0 1px hsl(var(--risk-low) / 0.35)',
        'glow-medium': '0 0 0 1px hsl(var(--risk-medium) / 0.35)',
      },
      backgroundImage: {
        grid: 'linear-gradient(hsl(var(--border) / 0.7) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.7) 1px, transparent 1px)',
        'radial-fade':
          'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0, 0, 0, 0.02), transparent 70%)',
        shimmer:
          'linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.04), transparent)',
      },
      backgroundSize: {
        grid: '32px 32px',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 hsl(var(--foreground) / 0.2)' },
          '70%': { boxShadow: '0 0 0 8px hsl(var(--foreground) / 0)' },
          '100%': { boxShadow: '0 0 0 0 hsl(var(--foreground) / 0)' },
        },
        'sweep-y': {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '50%': { opacity: '1' },
          '100%': { transform: 'translateY(100%)', opacity: '0' },
        },
        'progress-stripe': {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '24px 0' },
        },
        'count-blink': {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.8s infinite',
        'fade-in': 'fade-in 0.25s ease-out both',
        'fade-up': 'fade-up 0.35s ease-out both',
        'scale-in': 'scale-in 0.22s ease-out both',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'sweep-y': 'sweep-y 2.4s ease-in-out infinite',
        'progress-stripe': 'progress-stripe 0.8s linear infinite',
        'count-blink': 'count-blink 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
