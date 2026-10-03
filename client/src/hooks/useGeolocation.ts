import { useCallback, useState } from 'react';

export interface Coordinates {
    lat: number;
    lon: number;
}

function geolocationErrorMessage(error: GeolocationPositionError): string {
    switch (error.code) {
        case error.PERMISSION_DENIED:
            return 'Accès à votre position refusé. Autorisez la géolocalisation dans votre navigateur.';
        case error.POSITION_UNAVAILABLE:
            return 'Votre position est indisponible pour le moment.';
        case error.TIMEOUT:
            return 'La localisation a pris trop de temps. Réessayez.';
        default:
            return 'Impossible de déterminer votre position.';
    }
}

/** Wrapper around navigator.geolocation with French error messages. */
export function useGeolocation() {
    const [locating, setLocating] = useState(false);

    const locate = useCallback(
        () =>
            new Promise<Coordinates>((resolve, reject) => {
                if (!('geolocation' in navigator)) {
                    reject(new Error("La géolocalisation n'est pas disponible sur cet appareil."));
                    return;
                }
                if (!window.isSecureContext) {
                    reject(new Error('La géolocalisation nécessite une connexion sécurisée (HTTPS).'));
                    return;
                }
                setLocating(true);
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        setLocating(false);
                        resolve({ lat: position.coords.latitude, lon: position.coords.longitude });
                    },
                    (error) => {
                        setLocating(false);
                        reject(new Error(geolocationErrorMessage(error)));
                    },
                    { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
                );
            }),
        [],
    );

    return { locate, locating };
}
