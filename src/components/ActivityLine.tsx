import { hasKey } from '../i18n';
import { useLanguage } from '../i18n/use-language';
import type { Activity } from '../lib/api';

// Activity in product language (FR-014): the server sends web's i18n key
// (`kbAgent.activity.X`); this app maps it to `conversation.activity.X` and
// falls back to a generic "Working…" rather than exposing a tool name.
export function activityLabelKey(labelKey: string): string {
  const leaf = labelKey.split('.').pop() ?? '';
  return `conversation.activity.${leaf}`;
}

export function ActivityLine({ activity, live = false }: { activity: Activity; live?: boolean }) {
  const { t, language } = useLanguage();
  const key = activityLabelKey(activity.labelKey);
  const label = hasKey(language, key) || hasKey('en', key) ? t(key) : t('conversation.working');
  return (
    <div
      className="flex items-center gap-2 text-sm text-muted-foreground"
      data-testid="activity-line"
      aria-live={live ? 'polite' : undefined}
    >
      {live && (
        <span className="inline-flex gap-0.5" aria-hidden="true">
          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        </span>
      )}
      <span>
        {label}
        {activity.target ? <span className="text-foreground"> · {activity.target}</span> : null}
      </span>
    </div>
  );
}
