import * as React from 'react';
import { Button } from '@doctiling/ui/atoms/button';
import { useLanguage } from '../../i18n/use-language';
import type { ConvertedSheet } from '../../lib/api';

type Props = { name: string; sheets: ConvertedSheet[]; onConfirm: (chosen: ConvertedSheet[]) => void; onSkip: () => void };

// spec 054 TS-619: a workbook with several sheets — every sheet starts chosen; each chosen one becomes a table.
export function SheetPicker({ name, sheets, onConfirm, onSkip }: Props) {
  const { t } = useLanguage();
  const [chosen, setChosen] = React.useState<boolean[]>(() => sheets.map(() => true));
  const count = chosen.filter(Boolean).length;
  return (
    <div className="space-y-3" data-testid="sheet-picker">
      <h3 className="font-display text-base font-semibold">{t('newDocument.sheets.heading')}</h3>
      <p className="text-sm text-muted-foreground">{t('newDocument.sheets.description', { name, count: sheets.length })}</p>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {sheets.map((s, i) => (
          <li key={`${s.name}-${i}`}>
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 px-3 py-2">
              <input
                type="checkbox"
                className="h-5 w-5 accent-primary"
                checked={chosen[i] ?? false}
                onChange={(e) => setChosen((c) => c.map((v, j) => (j === i ? e.target.checked : v)))}
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{t('newDocument.sheets.rows', { count: s.rowCount })}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="lg" onClick={onSkip}>
          {t('newDocument.sheets.skip')}
        </Button>
        <Button size="lg" disabled={count === 0} onClick={() => onConfirm(sheets.filter((_, i) => chosen[i]))}>
          {t('newDocument.sheets.confirm', { count })}
        </Button>
      </div>
    </div>
  );
}
