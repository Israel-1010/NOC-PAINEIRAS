/** @type {import('tailwindcss').Config} */
// Tailwind so para o Digital Twin (src/infra): classes presas a .infra-root e sem o reset global
// (preflight), para nao alterar o visual do resto do portal.
export default {
  content: ['./src/infra/**/*.{ts,tsx}'],
  important: '.infra-root',
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        surface: '#050914',
        panel: 'rgba(8, 13, 26, 0.78)',
        cyanline: '#28d7ff',
      },
      boxShadow: {
        glow: '0 0 36px rgba(34, 211, 238, 0.22)',
      },
    },
  },
  plugins: [],
};
