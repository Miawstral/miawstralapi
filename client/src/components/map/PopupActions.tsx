import { Button } from '@/components/ui/button';

/** "Partir d'ici" / "Y aller" buttons shared by the stop and point popups. */
export function PopupActions({ onOrigin, onDestination }: { onOrigin: () => void; onDestination: () => void }) {
    return (
        <div className="flex gap-1.5">
            <Button size="sm" variant="secondary" className="flex-1" onClick={onOrigin}>
                <span className="h-2.5 w-2.5 rounded-full border-2 border-foreground" aria-hidden="true" />
                Partir d’ici
            </Button>
            <Button size="sm" variant="primary" className="flex-1" onClick={onDestination}>
                <span className="h-2.5 w-2.5 rounded-[3px] bg-primary-foreground" aria-hidden="true" />
                Y aller
            </Button>
        </div>
    );
}
