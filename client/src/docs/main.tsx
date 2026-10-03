import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './docs.css';
import { DocsApp } from './DocsApp';

const root = document.getElementById('docs-root');
if (!root) throw new Error('Élément #docs-root introuvable');

createRoot(root).render(
    <StrictMode>
        <DocsApp />
    </StrictMode>,
);
