/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** Backend base URL, e.g. "https://api.example.org". Empty = same origin. */
    readonly VITE_API_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
