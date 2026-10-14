/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly SMTP_HOST: string
  readonly SMTP_PORT: string
  readonly SMTP_USER: string
  readonly SMTP_PASS: string
  readonly SMTP_FROM_EMAIL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
