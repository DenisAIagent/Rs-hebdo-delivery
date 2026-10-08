import { supabaseAdmin } from '../utils/supabase';

/**
 * Interrupteur admin « Notifications de livraison » (app_settings.DELIVERY_NOTIFICATIONS,
 * Admin > Reglages). Coupe : aucun email « nouveau papier livre » n'est envoye.
 * Absent = actif. Les alertes d'erreur (WordPress, canari) ne sont pas concernees.
 */
export const NOTIFY_SETTING_KEY = 'DELIVERY_NOTIFICATIONS';

export function parseNotificationSetting(value: string | null | undefined): boolean {
  return value?.trim().toLowerCase() !== 'false';
}

export async function isDeliveryNotificationEnabled(): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', NOTIFY_SETTING_KEY)
    .maybeSingle();
  if (error) {
    console.error('[notificationPolicy] lecture du reglage impossible, notifications actives:', error.message);
    return true;
  }
  return parseNotificationSetting(data?.value);
}
