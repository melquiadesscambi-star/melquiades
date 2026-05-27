import { supabaseAdmin } from './supabase'
import { MACRO_AREE, GENERI } from '@/types'
import type { NudgeData, MacroArea } from '@/types'

export async function calcolaNudgeData(): Promise<NudgeData> {
  const { data: manoscritti, error } = await supabaseAdmin
    .from('manoscritti')
    .select('macro_area, genere')
    .eq('stato', 'in_attesa')

  if (error || !manoscritti) return {}

  // Inizializza struttura con tutti i generi a 0
  const result: NudgeData = {}

  for (const macroArea of MACRO_AREE) {
    result[macroArea] = {
      totale: 0,
      generi: {},
    }
    for (const genere of GENERI[macroArea as MacroArea]) {
      result[macroArea].generi[genere] = 0
    }
  }

  // Conta i manoscritti per genere
  for (const m of manoscritti) {
    if (result[m.macro_area]) {
      result[m.macro_area].totale++
      if (result[m.macro_area].generi[m.genere] !== undefined) {
        result[m.macro_area].generi[m.genere]++
      }
    }
  }

  return result
}
