/** Client config. Analysis secrets must NEVER be VITE_* — they live on the Netlify Function. */

function read(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name]
  return typeof value === 'string' ? value.trim() : ''
}

export const config = {
  supabaseUrl: read('VITE_SUPABASE_URL'),
  supabaseAnonKey: read('VITE_SUPABASE_ANON_KEY'),
  /** Relative Netlify Function — no client API key. */
  analysisUrl: '/.netlify/functions/analyze',
  appName: 'TouchStat',
}

export function hasSupabase(): boolean {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey)
}

export function missingEnvMessage(kind: 'supabase' | 'analysis'): string {
  if (kind === 'supabase') {
    return 'Cloud sync needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  }
  return 'Set OPENAI_API_KEY on the Netlify Function (server). Manual tagging still works.'
}
