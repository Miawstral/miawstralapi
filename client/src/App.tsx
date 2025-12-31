import { useState } from 'react'
import axios from 'axios'
import { JourneyPlanner } from './components/JourneyPlanner'
import { RouteResults } from './components/RouteResults'
import type { RouteRequest, RouteResponse } from './types'
import { motion, AnimatePresence } from 'framer-motion'
import './App.css'

function App() {
  const [routes, setRoutes] = useState<RouteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (request: RouteRequest) => {
    setLoading(true);
    setError(null);
    setRoutes(null);

    try {
      // API call to backend
      const response = await axios.post<RouteResponse>('/api/routes/calculate', request);
      console.log("Routes received:", response.data);

      // The backend returns { success: true, data: RouteResponse } or simple RouteResponse?
      // Looking at src/api/routes/routes.controller.ts: res.status(200).json({ success: true, data: result });
      // So accessing response.data.data

      // Wait, axios gives response.data which is the JSON body.
      // So it is response.data.data.
      // Let's type it safely.
      const payload = response.data as any;
      if (payload.success && payload.data) {
        setRoutes(payload.data);
      } else {
        setError(payload.message || "Failed to calculate routes");
      }

    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <header className="text-center text-white mb-12 pt-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-2 drop-shadow-md">
              MiawStral 🚌
            </h1>
            <p className="text-lg md:text-xl opacity-90 font-light">
              Le moyen le plus rapide de traverser Toulon.
            </p>
          </motion.div>
        </header>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left/Top: Planner Form */}
          <div className="lg:col-span-5">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <JourneyPlanner onSearch={handleSearch} isLoading={loading} />

              {error && (
                <div className="mt-4 p-4 bg-red-100 border border-red-200 text-red-700 rounded-lg text-sm shadow animate-pulse">
                  🚨 {error}
                </div>
              )}
            </motion.div>
          </div>

          {/* Right/Bottom: Results */}
          <div className="lg:col-span-7">
            <AnimatePresence>
              {routes && (
                <RoutesList data={routes} />
              )}
            </AnimatePresence>

            {!routes && !loading && !error && (
              <div className="text-center text-white/50 mt-10 lg:mt-32 italic">
                Entrez votre trajet pour voir les résultats...
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

// Wrapper for animation
function RoutesList({ data }: { data: RouteResponse }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.5 }}
    >
      <RouteResults data={data} />
    </motion.div>
  )
}

export default App
