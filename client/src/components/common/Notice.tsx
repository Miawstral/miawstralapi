import type { ReactNode } from 'react';
import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'info' | 'warning' | 'error';

const tones: Record<Tone, { icon: string; Icon: typeof Info }> = {
    info: { icon: 'text-muted-foreground', Icon: Info },
    warning: { icon: 'text-warning', Icon: TriangleAlert },
    error: { icon: 'text-danger', Icon: CircleAlert },
};

interface NoticeProps {
    tone?: Tone;
    title?: string;
    children?: ReactNode;
    action?: ReactNode;
    className?: string;
}

export function Notice({ tone = 'info', title, children, action, className }: NoticeProps) {
    const { icon, Icon } = tones[tone];
    return (
        <div
            role={tone === 'error' ? 'alert' : undefined}
            className={cn('flex gap-2.5 rounded-lg bg-subtle p-3 text-[13px] shadow-control', className)}
        >
            <Icon className={cn('mt-px h-4 w-4 shrink-0', icon)} aria-hidden="true" />
            <div className="min-w-0 flex-1 space-y-0.5">
                {title && <div className="font-medium text-foreground">{title}</div>}
                {children && <div className="leading-relaxed text-muted-foreground">{children}</div>}
                {action && <div className="pt-1.5">{action}</div>}
            </div>
        </div>
    );
}
