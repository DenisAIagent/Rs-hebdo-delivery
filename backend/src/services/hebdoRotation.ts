import { supabaseAdmin } from '../utils/supabase';
import { nextFridayString } from '../utils/dates';

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // every hour

interface HebdoDates {
  start_date: string | null;
  end_date: string | null;
}

/**
 * start_date / end_date sont les dates de DIFFUSION du numero (vendredi → vendredi).
 * Le numero "en cours" est celui sur lequel les journalistes livrent : le prochain
 * a paraitre. Il cesse donc d'etre en cours le jour de sa diffusion (start_date),
 * et le suivant prend le relais. Sans start_date, on retombe sur end_date.
 */
export function isRotationDue(current: HebdoDates, now: Date): boolean {
  const trigger = current.start_date || current.end_date;
  if (!trigger) return false;
  return now >= new Date(trigger + 'T00:00:00Z');
}

/** Fenetre de diffusion du numero suivant : le vendredi d'apres, sur une semaine. */
export function nextHebdoWindow(current: HebdoDates): { start: string; end: string } {
  const start = current.start_date
    ? nextFridayString(new Date(current.start_date + 'T00:00:00Z'))
    : (current.end_date as string);
  return { start, end: nextFridayString(new Date(start + 'T00:00:00Z')) };
}

/**
 * Si la date de diffusion du numero en cours est arrivee, cree le numero suivant
 * (N+1) et en fait le numero en cours.
 */
async function rotateHebdoIfNeeded(): Promise<void> {
  try {
    const { data: current, error } = await supabaseAdmin
      .from('hebdo_config')
      .select('*')
      .eq('is_current', true)
      .single();

    if (error || !current) {
      console.log('[hebdo-rotation] No current hebdo found, skipping.');
      return;
    }

    if (!current.start_date && !current.end_date) {
      console.log('[hebdo-rotation] Current hebdo has no dates, skipping.');
      return;
    }

    if (!isRotationDue(current, new Date())) {
      return; // not yet time to rotate
    }

    const nextNumero = current.numero + 1;
    const { start: nextStartStr, end: nextEndStr } = nextHebdoWindow(current);

    // Unset current
    await supabaseAdmin
      .from('hebdo_config')
      .update({ is_current: false })
      .eq('id', current.id);

    // Create next hebdo
    const { error: insertError } = await supabaseAdmin
      .from('hebdo_config')
      .insert({
        numero: nextNumero,
        label: `RSH${nextNumero}`,
        start_date: nextStartStr,
        end_date: nextEndStr,
        is_current: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[hebdo-rotation] Error creating next hebdo:', insertError);
      // Restore current flag
      await supabaseAdmin
        .from('hebdo_config')
        .update({ is_current: true })
        .eq('id', current.id);
      return;
    }

    console.log(
      `[hebdo-rotation] Rotated: RSH${current.numero} -> RSH${nextNumero} ` +
        `(window: ${nextStartStr} -> ${nextEndStr})`,
    );
  } catch (err) {
    console.error('[hebdo-rotation] Unexpected error:', err);
  }
}

/**
 * Start the hebdo auto-rotation: check immediately on boot, then every hour.
 */
export function startHebdoRotation(): void {
  console.log('[hebdo-rotation] Auto-rotation enabled (check every hour, Friday→Friday)');
  rotateHebdoIfNeeded();
  setInterval(rotateHebdoIfNeeded, CHECK_INTERVAL_MS);
}
