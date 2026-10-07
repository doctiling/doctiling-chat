/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DOCTILING_API_ORIGIN?: string;
  readonly VITE_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
