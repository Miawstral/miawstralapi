import { Fragment } from 'react';
import { ChevronRight, Footprints } from 'lucide-react';
import { LineBadge } from '@/components/common/LineBadge';
import type { RouteOption } from '@/types';

/** Compact sequence of a route: line badges and walking minutes. */
export function RouteGlyphs({ route }: { route: RouteOption }) {
    const items = route.steps.filter(step => step.type === 'bus' || step.duration > 0);
    return (
        <span className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1">
            {items.map((step, index) => (
                <Fragment key={index}>
                    {index > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" aria-hidden="true" />}
                    {step.type === 'bus' ? (
                        <LineBadge line={step.line} color={step.color} title={step.lineName} />
                    ) : (
                        <span className="inline-flex items-center gap-0.5 text-muted-foreground" title={`Marche ${step.duration} min`}>
                            <Footprints className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="text-2xs font-medium tnum">{step.duration}</span>
                            <span className="sr-only"> minutes de marche</span>
                        </span>
                    )}
                </Fragment>
            ))}
        </span>
    );
}
