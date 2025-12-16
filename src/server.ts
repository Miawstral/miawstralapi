import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
// routes 
import lineRouter from './api/lines/lines.routes';
import stopsRouter from './api/stops/stops.routes';
import cacheRouter from './api/cache/cache.routes';
import routesRouter from './api/routes/routes.routes';
// pages 
import mainPage from './pages/main';
const app: Application = express();
const PORT = process.env.PORT || 3000;


app.use(cors());
app.use(express.json());


app.use('/api/lines', lineRouter);
app.use('/api/stops', stopsRouter);
app.use('/api/routes', routesRouter);
app.use('/refresh', cacheRouter);
app.use('/', mainPage);


app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(`[ERROR] ${req.method} ${req.path} - ${err.message}`)

    const errorMessage = process.env.NODE_ENV === 'production' ? 'An internal server error occured' : err.message;
    res.status(500).json({
        success: false,
        message: errorMessage,
    })
});


app.listen(PORT, () => {
    console.log(`[📦] Miawstral is running on http://localhost:${PORT}`);
});