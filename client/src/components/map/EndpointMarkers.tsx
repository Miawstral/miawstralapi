import { Marker, Tooltip } from 'react-leaflet';
import { placeLabel, placeLatLng, type PlaceSelection } from '@/lib/places';
import { destinationIcon, originIcon } from './icons';

interface EndpointMarkersProps {
    origin: PlaceSelection | null;
    destination: PlaceSelection | null;
}

function Endpoint({ place, kind }: { place: PlaceSelection; kind: 'origin' | 'destination' }) {
    const position = placeLatLng(place);
    if (!position) return null;
    return (
        <Marker
            position={position}
            icon={kind === 'origin' ? originIcon : destinationIcon}
            zIndexOffset={kind === 'origin' ? 1000 : 900}
            keyboard={false}
            alt={kind === 'origin' ? 'Départ' : 'Arrivée'}
        >
            <Tooltip direction="top">
                {kind === 'origin' ? 'Départ' : 'Arrivée'} · {placeLabel(place)}
            </Tooltip>
        </Marker>
    );
}

export function EndpointMarkers({ origin, destination }: EndpointMarkersProps) {
    return (
        <>
            {origin && <Endpoint place={origin} kind="origin" />}
            {destination && <Endpoint place={destination} kind="destination" />}
        </>
    );
}
