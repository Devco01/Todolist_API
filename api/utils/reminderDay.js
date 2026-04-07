/**
 * Logique partagée : rappel le jour J équivalence calendrier + fenêtre matinale locale.
 * Aligné avec le cron Vercel (CRON_TZ, NOTIFICATION_CRON_HOUR_UTC) et shouldNotify().
 */

const DEFAULT_TZ = 'Europe/Paris';

const getReminderTimeZone = () =>
  process.env.CRON_TZ || DEFAULT_TZ;

/** YYYY-MM-DD (en-CA) pour une instant dans une timezone */
const calendarDateInTz = (date, timeZone) =>
  date.toLocaleDateString('en-CA', { timeZone });

/** Heure 0–23 dans la timezone */
const hourInTimeZone = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: 'numeric',
    hourCycle: 'h23'
  }).formatToParts(date);
  const h = parts.find((p) => p.type === 'hour');
  return h ? parseInt(h.value, 10) : date.getUTCHours();
};

/**
 * dueDateFromDb: string 'YYYY-MM-DD' ou Date
 */
const dueDateString = (dueDateFromDb) => {
  if (!dueDateFromDb) return null;
  if (dueDateFromDb instanceof Date) {
    return dueDateFromDb.toISOString().slice(0, 10);
  }
  const s = String(dueDateFromDb);
  return s.length >= 10 ? s.slice(0, 10) : s;
};

const dueDateIsTodayInTz = (dueDateFromDb, timeZone = getReminderTimeZone()) => {
  const due = dueDateString(dueDateFromDb);
  if (!due) return false;
  const today = calendarDateInTz(new Date(), timeZone);
  return due === today;
};

/**
 * Fenêtre d'envoi côté appli (hors cron unique Vercel) : après REMINDER_LOCAL_HOUR (défaut 8h) dans CRON_TZ.
 */
const isPastReminderHourLocal = (now = new Date(), timeZone = getReminderTimeZone()) => {
  const target = parseInt(process.env.REMINDER_LOCAL_HOUR || '8', 10);
  const clamped = Number.isFinite(target) ? Math.min(23, Math.max(0, target)) : 8;
  return hourInTimeZone(now, timeZone) >= clamped;
};

module.exports = {
  getReminderTimeZone,
  calendarDateInTz,
  hourInTimeZone,
  dueDateString,
  dueDateIsTodayInTz,
  isPastReminderHourLocal
};
