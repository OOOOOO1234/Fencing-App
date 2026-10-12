/** Runtime feature flags from Vite env. App always works in local/demo mode without keys. */

function read(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name]
  return typeof value === 'string' ? value.trim() : ''
}

export const config = {
  supabaseUrl: read('VITE_SUPABASE_URL'),
  supabaseAnonKey: read('VITE_SUPABASE_ANON_KEY'),
  analysisApiUrl: read('VITE_ANALYSIS_API_URL'),
  analysisApiKey: read('VITE_ANALYSIS_API_KEY'),
  appName: 'Fencing-App',
}

export function hasSupabase(): boolean {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey)
}

export function hasAnalysisProvider(): boolean {
  return Boolean(config.analysisApiUrl && config.analysisApiKey)
}

export function missingEnvMessage(kind: 'supabase' | 'analysis'): string {
  if (kind === 'supabase') {
    return 'Cloud sync needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Local mode still works.'
  }
  return 'AI analysis needs VITE_ANALYSIS_API_URL and VITE_ANALYSIS_API_KEY. Manual tagging always works.'
}
