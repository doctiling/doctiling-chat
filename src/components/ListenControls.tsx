import { Pause, Play, Square, Volume2 } from 'lucide-react';
import { IconButton } from './IconButton';
import { useLanguage } from '../i18n/use-language';
import { useSpeech } from '../lib/speech';

type Props = {
  /** Identifies the message, so only one is read at a time. */
  id: string;
  /** What to read (already without code and tables). Nothing to read, no controls. */
  text: string;
  /** Label of the idle button; the reply and the document say different things. */
  listenLabel?: string;
};

export function ListenControls({ id, text, listenLabel }: Props) {
  const { t } = useLanguage();
  const speech = useSpeech();
  if (!speech.supported || !text.trim()) return null;
  const mine = speech.speakingId === id;
  const label = !mine ? (listenLabel ?? t('conversation.listen')) : speech.paused ? t('conversation.listenResume') : t('conversation.listenPause');
  const Icon = !mine ? Volume2 : speech.paused ? Play : Pause;
  return (
    <div className="flex items-center gap-0.5" data-testid="listen-controls">
      <IconButton label={label} onClick={() => speech.toggle(id, text)} className="h-9 w-9 min-h-[36px] min-w-[36px]">
        <Icon strokeWidth={1.75} />
      </IconButton>
      {mine && (
        <IconButton label={t('conversation.listenStop')} onClick={speech.stop} className="h-9 w-9 min-h-[36px] min-w-[36px]">
          <Square strokeWidth={1.75} />
        </IconButton>
      )}
    </div>
  );
}
