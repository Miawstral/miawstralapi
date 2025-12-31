import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, MapPin, Navigation, Clock } from 'lucide-react';
import type { Stop, RouteRequest } from '../types';

interface JourneyPlannerProps {
    onSearch: (request: RouteRequest) => void;
    isLoading: boolean;
}

export function JourneyPlanner({ onSearch, isLoading }: JourneyPlannerProps) {
    const [stops, setStops] = useState<Stop[]>([]);

    // Form state
    const [fromQuery, setFromQuery] = useState('');
    const [toQuery, setToQuery] = useState('');
    const [fromStop, setFromStop] = useState<Stop | null>(null);
    const [toStop, setToStop] = useState<Stop | null>(null);
    const [time, setTime] = useState<string>(() => {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    });

    // Suggestions
    const [showFromSuggestions, setShowFromSuggestions] = useState(false);
    const [showToSuggestions, setShowToSuggestions] = useState(false);

    useEffect(() => {
        // Fetch all stops on mount to cache them for autocomplete
        const fetchStops = async () => {
            try {
                const res = await axios.get<Stop[]>('/api/stops');
                if (Array.isArray(res.data)) {
                    setStops(res.data);
                }
            } catch (error) {
                console.error("Failed to fetch stops", error);
            }
        };
        fetchStops();
    }, []);

    const filterStops = (query: string) => {
        if (!query) return [];
        const lower = query.toLowerCase();
        return stops.filter(s =>
            s.name.toLowerCase().includes(lower) ||
            s.stopPointId.toLowerCase().includes(lower)
        ).slice(0, 5);
    };

    const handleSearch = () => {
        // If we have selected stops, use their ID/coords
        // If not, we might want to geocode (future feature), for now we require stop selection or assume text is ID?
        // Let's enforce selection for now or allow free text if it matches an ID exactly.

        const request: RouteRequest = {
            from: {
                stopId: fromStop?.stopPointId,
                name: fromStop?.name,
                lat: fromStop ? parseFloat(fromStop.latitude) : undefined,
                lon: fromStop ? parseFloat(fromStop.longitude) : undefined
            },
            to: {
                stopId: toStop?.stopPointId,
                name: toStop?.name,
                lat: toStop ? parseFloat(toStop.latitude) : undefined,
                lon: toStop ? parseFloat(toStop.longitude) : undefined
            },
            departureTime: time,
            maxWalkingDistance: 800,
            maxTransfers: 3
        };

        // Fallback: If user typed "TOLIBE" but didn't click suggestion
        if (!request.from.stopId && fromQuery) {
            const exactMatch = stops.find(s => s.stopPointId === fromQuery.toUpperCase());
            if (exactMatch) {
                request.from.stopId = exactMatch.stopPointId;
                request.from.name = exactMatch.name;
                request.from.lat = parseFloat(exactMatch.latitude);
                request.from.lon = parseFloat(exactMatch.longitude);
            }
        }
        if (!request.to.stopId && toQuery) {
            const exactMatch = stops.find(s => s.stopPointId === toQuery.toUpperCase());
            if (exactMatch) {
                request.to.stopId = exactMatch.stopPointId;
                request.to.name = exactMatch.name;
                request.to.lat = parseFloat(exactMatch.latitude);
                request.to.lon = parseFloat(exactMatch.longitude);
            }
        }

        if (!request.from.stopId && !request.from.lat) {
            alert("Veuillez sélectionner un point de départ valide.");
            return;
        }
        if (!request.to.stopId && !request.to.lat) {
            alert("Veuillez sélectionner une destination valide.");
            return;
        }

        onSearch(request);
    };

    const handleSelectFrom = (stop: Stop) => {
        setFromStop(stop);
        setFromQuery(stop.name);
        setShowFromSuggestions(false);
    }

    const handleSelectTo = (stop: Stop) => {
        setToStop(stop);
        setToQuery(stop.name);
        setShowToSuggestions(false);
    }

    return (
        <Card className="w-full max-w-md mx-auto shadow-xl bg-white/90 backdrop-blur-sm border-0">
            <CardHeader className="pb-4">
                <CardTitle className="text-2xl font-bold text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Planifier un trajet
                </CardTitle>
                <CardDescription className="text-center">
                    Trouvez l'itinéraire le plus rapide
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* FROM Input */}
                <div className="space-y-2 relative">
                    <Label htmlFor="from" className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-green-600" />
                        Départ
                    </Label>
                    <div className="relative">
                        <Input
                            id="from"
                            placeholder="Nom d'arrêt ou code (ex: Liberté)"
                            value={fromQuery}
                            onChange={(e) => {
                                setFromQuery(e.target.value);
                                setFromStop(null);
                                setShowFromSuggestions(true);
                            }}
                            onFocus={() => setShowFromSuggestions(true)}
                            className="pl-10 transition-all border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                        />
                        <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />

                        {showFromSuggestions && fromQuery.length > 0 && !fromStop && (
                            <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                                {filterStops(fromQuery).map(stop => (
                                    <div
                                        key={stop.stopPointId}
                                        className="p-2 hover:bg-gray-100 cursor-pointer text-sm flex justify-between"
                                        onClick={() => handleSelectFrom(stop)}
                                    >
                                        <span className="font-medium text-gray-800">{stop.name}</span>
                                        <span className="text-gray-500 text-xs bg-gray-100 px-1 rounded">{stop.stopPointId}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* TO Input */}
                <div className="space-y-2 relative">
                    <Label htmlFor="to" className="flex items-center gap-2">
                        <Navigation className="w-4 h-4 text-red-600" />
                        Destination
                    </Label>
                    <div className="relative">
                        <Input
                            id="to"
                            placeholder="Nom d'arrêt ou code"
                            value={toQuery}
                            onChange={(e) => {
                                setToQuery(e.target.value);
                                setToStop(null);
                                setShowToSuggestions(true);
                            }}
                            onFocus={() => setShowToSuggestions(true)}
                            className="pl-10 transition-all border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                        />
                        <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />

                        {showToSuggestions && toQuery.length > 0 && !toStop && (
                            <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                                {filterStops(toQuery).map(stop => (
                                    <div
                                        key={stop.stopPointId}
                                        className="p-2 hover:bg-gray-100 cursor-pointer text-sm flex justify-between"
                                        onClick={() => handleSelectTo(stop)}
                                    >
                                        <span className="font-medium text-gray-800">{stop.name}</span>
                                        <span className="text-gray-500 text-xs bg-gray-100 px-1 rounded">{stop.stopPointId}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* TIME Input */}
                <div className="space-y-2">
                    <Label htmlFor="time" className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-purple-600" />
                        Heure de départ
                    </Label>
                    <Input
                        id="time"
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="font-medium text-gray-700"
                    />
                </div>

                <Button
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all shadow-md py-6 text-lg"
                    onClick={handleSearch}
                    disabled={isLoading}
                >
                    {isLoading ? 'Recherche en cours...' : 'Rechercher'}
                </Button>
            </CardContent>
        </Card>
    );
}
