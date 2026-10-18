/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_AI_MODE?: 'live' | 'mock';
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
