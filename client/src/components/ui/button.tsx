import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
    'inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-medium transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
    {
        variants: {
            variant: {
                primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
                secondary: 'bg-surface text-foreground shadow-control hover:bg-subtle',
                ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
                subtle: 'bg-muted text-foreground hover:bg-accent',
            },
            size: {
                sm: 'h-8 px-2.5 text-[13px]',
                md: 'h-9 px-3',
                lg: 'h-10 px-4',
                icon: 'h-8 w-8',
                'icon-sm': 'h-7 w-7 rounded-md [&_svg]:size-3.5',
            },
        },
        defaultVariants: { variant: 'secondary', size: 'md' },
    },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { className, variant, size, type = 'button', ...props },
    ref,
) {
    return <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
