import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
}

export default function PrimaryButton({ children, icon, variant = 'primary', className = '', ...props }: PrimaryButtonProps) {
  const variants = {
    primary: 'border-cyan-300/50 bg-cyan-300 text-slate-950 shadow-glow hover:bg-cyan-200',
    secondary: 'border-slate-400/30 bg-white/8 text-slate-50 hover:bg-white/14',
    ghost: 'border-transparent bg-transparent text-slate-300 hover:bg-white/10 hover:text-white',
  };

  return (
    <button
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${variants[variant]} ${className}`}
      {...props}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}
