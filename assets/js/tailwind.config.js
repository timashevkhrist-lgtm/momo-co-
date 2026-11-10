/* Tailwind Play CDN config — дизайн-токены MOMO & CO. */
tailwind.config = {
    theme: {
        extend: {
            colors: {
                cobalt: {
                    DEFAULT: '#0038FF',
                    hover: '#002ED6',
                    soft: '#EAF0FF',
                    subtle: 'rgba(0, 56, 255, 0.08)'
                },
                paper: {
                    DEFAULT: '#F9F8F5',
                    card: '#FFFFFF',
                    tint: '#F1EFEA',
                    border: 'rgba(17, 17, 17, 0.08)'
                },
                ink: {
                    DEFAULT: '#111111',
                    muted: '#6B7280',
                    faint: '#9CA3AF'
                }
            },
            fontFamily: {
                syne: ['Syne', 'sans-serif'],
                jakarta: ['Plus Jakarta Sans', 'sans-serif'],
                mono: ['Space Mono', 'monospace']
            }
        }
    }
};
