import type { RouteResponse, RouteOption, BusStep, WalkStep } from '../types';
import { Card, CardContent } from "@/components/ui/card";
import { Footprints, ArrowRight, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

interface RouteResultsProps {
    data: RouteResponse | null;
}

export function RouteResults({ data }: RouteResultsProps) {
    if (!data || !data.routes || data.routes.length === 0) {
        return null;
    }

    return (
        <div className="w-full max-w-2xl mx-auto space-y-4 pb-20">
            <h2 className="text-xl font-semibold text-white mb-4 pl-1 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Résultats ({data.routes.length})
            </h2>

            <div className="space-y-4">
                {data.routes.map((route, idx) => (
                    <RouteCard key={idx} route={route} index={idx} />
                ))}
            </div>
        </div>
    );
}

function RouteCard({ route, index }: { route: RouteOption, index: number }) {
    // Total walking
    const totalWalk = Math.round(route.walkingDistance);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
        >
            <Card className="overflow-hidden border-0 shadow-lg bg-white/95 backdrop-blur">
                <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row">
                        {/* Left Summary Section */}
                        <div className="p-4 bg-gray-50 flex-none md:w-32 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-gray-100">
                            <div className="text-3xl font-bold text-gray-800">{route.duration}<span className="text-sm font-normal text-gray-500">min</span></div>
                            <div className="text-xs text-gray-500 mt-1">{route.transfers} correspondance{route.transfers > 1 ? 's' : ''}</div>
                            <div className="flex items-center gap-1 text-xs text-green-600 mt-2">
                                <Footprints className="w-3 h-3" />
                                {totalWalk}m
                            </div>
                        </div>

                        {/* Right Timeline Section */}
                        <div className="p-4 flex-grow">
                            <div className="flex flex-col space-y-4">

                                {route.steps.map((step, sIdx) => (
                                    <div key={sIdx} className="relative pl-6 border-l-2 border-gray-200 last:border-0 pb-4 last:pb-0">
                                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-4 border-gray-200" />

                                        {step.type === 'walk' ? (
                                            <div className="text-sm text-gray-500 flex items-start gap-2">
                                                <Footprints className="w-4 h-4 mt-0.5" />
                                                <div>
                                                    <p>Marcher <span className="font-medium text-gray-700">{Math.round((step as WalkStep).distance)}m</span> vers {step.to.name}</p>
                                                    <p className="text-xs text-gray-400">{step.duration} min</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="h-8 min-w-8 px-2 rounded font-bold text-white flex items-center justify-center shadow-sm"
                                                        style={{ backgroundColor: (step as BusStep).color }}
                                                    >
                                                        {(step as BusStep).line}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-gray-800">{(step as BusStep).lineName}</p>
                                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                                            <span>{(step as BusStep).from.name}</span>
                                                            <ArrowRight className="w-3 h-3" />
                                                            <span>{(step as BusStep).to.name}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-gray-500 ml-11">
                                                    {(step as BusStep).departureTime} - {(step as BusStep).arrivalTime} • {(step as BusStep).stopsCount} arrêts
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                <div className="relative pl-6">
                                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-green-500 border-4 border-white shadow-sm" />
                                    <p className="font-medium text-gray-900">Arrivée</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}
