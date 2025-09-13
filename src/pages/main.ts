import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (req: Request, res: Response) => {
    const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MiawStral API</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            .container {
                text-align: center;
                padding: 2rem;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 15px;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            h1 {
                font-size: 3rem;
                margin-bottom: 1rem;
                text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
            }
            p {
                font-size: 1.2rem;
                opacity: 0.9;
            }
            .buttons-container {
                margin-top: 2rem;
                display: flex;
                gap: 1rem;
                justify-content: center;
                flex-wrap: wrap;
            }
            .btn {
                display: inline-block;
                padding: 12px 24px;
                font-size: 1.1rem;
                text-decoration: none;
                color: white;
                background: rgba(255, 255, 255, 0.2);
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-radius: 8px;
                transition: all 0.3s ease;
                backdrop-filter: blur(5px);
                font-weight: bold;
                cursor: pointer;
            }
            .btn:hover {
                background: rgba(255, 255, 255, 0.3);
                border-color: rgba(255, 255, 255, 0.5);
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
            }
            .btn-stops {
                background: rgba(76, 175, 80, 0.3);
                border-color: rgba(76, 175, 80, 0.5);
            }
            .btn-stops:hover {
                background: rgba(76, 175, 80, 0.5);
            }
            .btn-lines {
                background: rgba(33, 150, 243, 0.3);
                border-color: rgba(33, 150, 243, 0.5);
            }
            .btn-lines:hover {
                background: rgba(33, 150, 243, 0.5);
            }
            .btn-refresh {
                background: rgba(255, 152, 0, 0.3);
                border-color: rgba(255, 152, 0, 0.5);
            }
            .btn-refresh:hover {
                background: rgba(255, 152, 0, 0.5);
            }
            .loading {
                opacity: 0.6;
                pointer-events: none;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🚌 MiawStral est en ligne ! 🚌</h1>
            <p>L'API est opérationnelle et prête à servir les données de transport.</p>
            <div class="buttons-container">
                <a href="#" class="btn btn-stops" onclick="goToRandomStop()">🚏 Arrêt Aléatoire</a>
                <a href="#" class="btn btn-lines" onclick="goToRandomLine()">🚌 Ligne Aléatoire</a>
                <a href="#" class="btn btn-refresh" onclick="refreshCache()" id="refreshBtn">🔄 Smart Refresh</a>
                <a href="#" class="btn btn-refresh" onclick="forceFullRefresh()" id="fullRefreshBtn">🔄 Full Refresh</a>
            </div>
        </div>
        
        <script>
            // Liste des IDs de lignes disponibles
            const lineIds = ['1', '2', '3', '6', '10', '11', '12', '15', '16', '17', '18', '20', '23', '28', '29', '31', '33', '36', '39', '40', '55', '63', '65', '67', '68', '70', '72', '81', '82', '83', '84', '87', '91', '92', '98', 'U'];
            
            // Fonction pour obtenir un ID de ligne aléatoire
            function getRandomLineId() {
                return lineIds[Math.floor(Math.random() * lineIds.length)];
            }
            
            // Fonction pour obtenir un ID d'arrêt aléatoire (exemple)
            function getRandomStopId() {
                const stopIds = ['TOHOME', 'TOLIBE', 'TOTERM', 'TOCHAP', 'TOCENT', 'TOGARE', 'TOPORT'];
                return stopIds[Math.floor(Math.random() * stopIds.length)];
            }
            
            // Fonction pour naviguer vers un arrêt aléatoire
            function goToRandomStop() {
                const randomStopId = getRandomStopId();
                window.location.href = '/api/stops/' + randomStopId;
            }
            
            // Fonction pour naviguer vers une ligne aléatoire
            function goToRandomLine() {
                const randomLineId = getRandomLineId();
                window.location.href = '/api/lines/' + randomLineId;
            }
            
            // Fonction pour rafraîchir le cache (smart mode)
            async function refreshCache() {
                const btn = document.getElementById('refreshBtn');
                const originalText = btn.textContent;
                
                btn.textContent = '⏳ Smart Refresh...';
                btn.classList.add('loading');
                
                try {
                    const response = await fetch('/refresh/refresh', { method: 'POST' });
                    const result = await response.json();
                    
                    if (result.success) {
                        alert('Smart cache refresh completed!\\n\\nMode: ' + result.mode + '\\nSuccess: ' + result.data.successCount + '\\nWarnings: ' + result.data.warningCount + '\\nErrors: ' + result.data.errorCount + '\\nSuccess Rate: ' + result.data.successRate);
                    } else {
                        alert('Cache refresh failed: ' + result.message);
                    }
                } catch (error) {
                    alert('Error during cache refresh: ' + error.message);
                } finally {
                    btn.textContent = originalText;
                    btn.classList.remove('loading');
                }
            }
            
            // Fonction pour forcer un refresh complet
            async function forceFullRefresh() {
                if (!confirm('Force full refresh will scan ALL lines (1-300).\\nThis can take several minutes.\\n\\nContinue?')) {
                    return;
                }
                
                const btn = document.getElementById('fullRefreshBtn');
                const originalText = btn.textContent;
                
                btn.textContent = '⏳ Full Refresh...';
                btn.classList.add('loading');
                
                try {
                    const response = await fetch('/refresh/full', { method: 'POST' });
                    const result = await response.json();
                    
                    if (result.success) {
                        alert('Full cache refresh completed!\\n\\nMode: ' + result.mode + '\\nSuccess: ' + result.data.successCount + '\\nWarnings: ' + result.data.warningCount + '\\nErrors: ' + result.data.errorCount + '\\nSuccess Rate: ' + result.data.successRate);
                    } else {
                        alert('Full cache refresh failed: ' + result.message);
                    }
                } catch (error) {
                    alert('Error during full refresh: ' + error.message);
                } finally {
                    btn.textContent = originalText;
                    btn.classList.remove('loading');
                }
            }
        </script>
    </body>
    </html>
    `;
    
    res.send(html);
});

export default router;