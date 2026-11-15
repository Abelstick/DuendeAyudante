import { Copy, KeyRound, MessageCircle, RefreshCw, Save } from 'lucide-react';
import { useState } from 'react';
import { useEventScope } from '@/app/layout/EventLayout';
import type { Family } from '@/modules/families/domain/Family';
import { buildFamilyLinkMessage, type FamilyAccess, familyLinkUrl, normalizeSecretWord, SECRET_WORD_PATTERN, suggestSecretWord } from '@/modules/family-access/domain/FamilyAccess';
import { useSetFamilyWord } from '@/modules/family-access/presentation/hooks';
import { whatsappShareUrl } from '@/shared/lib/whatsapp';
import { Button, buttonClasses } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { Modal } from '@/shared/ui/Modal';
import { useToast } from '@/shared/ui/Toast';
import { TextField } from '@/shared/ui/TextField';

interface Props {
  family: Family;
  /** null = todavía no se creó el enlace de esta familia. */
  access: FamilyAccess | null;
  /** Integrantes que podrán entrar con el enlace (participantes con usuario). */
  eligibleCount: number;
  onClose: () => void;
}

/**
 * Enlace de la familia: el organizador elige una palabra secreta, copia el enlace
 * (que no cambia nunca) y lo manda al grupo de WhatsApp de esa familia.
 */
export function FamilyLinkModal({ family, access, eligibleCount, onClose }: Props) {
  const { event } = useEventScope();
  const setFamilyWord = useSetFamilyWord(event.id);
  const toast = useToast();
  const [current, setCurrent] = useState(access);
  const [editing, setEditing] = useState(access === null);
  const [word, setWord] = useState(() => access?.secretWord ?? suggestSecretWord());
  const [error, setError] = useState<string | null>(null);

  const normalized = normalizeSecretWord(word);
  const valid = SECRET_WORD_PATTERN.test(normalized);

  const save = async () => {
    setError(null);
    try {
      const saved = await setFamilyWord.mutateAsync({ familyId: family.id, word });
      setCurrent(saved);
      setWord(saved.secretWord);
      setEditing(false);
      toast.success(current ? 'Palabra secreta cambiada. El enlace sigue siendo el mismo.' : '¡Enlace de la familia creado!');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(done);
    } catch {
      toast.error('No se pudo copiar. Selecciona el texto y cópialo a mano.');
    }
  };

  const link = current ? familyLinkUrl(window.location.origin, current.linkToken) : '';
  const message = current
    ? buildFamilyLinkMessage({ eventName: event.name, familyName: family.name, appUrl: window.location.origin, linkToken: current.linkToken, secretWord: current.secretWord })
    : '';

  return (
    <Modal open title={`Enlace de la familia ${family.name}`} onClose={onClose}>
      <div className="space-y-5">
        <p className="text-base text-ink-700">
          Con este enlace y la palabra secreta, cada integrante elige su nombre y entra. <strong className="text-ink-900">No necesita usuario ni contraseña.</strong>
        </p>

        {editing ? (
          <div className="space-y-4">
            <TextField
              label="Palabra secreta de esta familia"
              hint="Una palabra fácil de decir por teléfono (de 4 a 20 letras o números, sin espacios)."
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="uppercase tracking-widest"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              error={word.trim() && !valid ? 'Usa solo letras y números, entre 4 y 20, sin espacios.' : undefined}
              trailing={
                <button
                  type="button"
                  onClick={() => setWord(suggestSecretWord())}
                  className="flex min-h-13 min-w-13 items-center justify-center rounded-xl border-2 border-night-900 bg-white text-night-900 hover:bg-brand-soft"
                  aria-label="Proponer otra palabra"
                  title="Proponer otra palabra"
                >
                  <RefreshCw className="size-6" aria-hidden />
                </button>
              }
            />
            {current && <Notice tone="warning">Si cambias la palabra, avísale a la familia: la anterior dejará de servir. El enlace no cambia.</Notice>}
            {error && <Notice tone="error">{error}</Notice>}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={save} loading={setFamilyWord.isPending} disabled={!valid} icon={<Save className="size-5" aria-hidden />}>
                {current ? 'Guardar la nueva palabra' : 'Crear el enlace'}
              </Button>
              {current && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditing(false);
                    setWord(current.secretWord);
                    setError(null);
                  }}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        ) : (
          current && (
            <div className="space-y-4">
              <dl className="space-y-2">
                <div className="rounded-xl border-2 border-night-900 bg-gold-100 px-4 py-3">
                  <dt className="eyebrow text-ink-700">Palabra secreta</dt>
                  <dd className="font-display select-all text-2xl font-extrabold tracking-widest text-night-900">{current.secretWord}</dd>
                </div>
                <div className="rounded-xl border-2 border-night-900 bg-white px-4 py-3">
                  <dt className="eyebrow text-ink-700">Enlace (no cambia)</dt>
                  <dd className="select-all break-all text-base font-semibold text-night-900">{link}</dd>
                </div>
              </dl>

              {eligibleCount === 0 ? (
                <Notice tone="warning">
                  Esta familia todavía no tiene integrantes con usuario. Agrégalos primero (uno por uno o con la tabla) para que aparezcan en la lista del enlace.
                </Notice>
              ) : (
                <p className="text-base text-ink-700">
                  Podrán entrar <strong className="text-ink-900">{eligibleCount}</strong> {eligibleCount === 1 ? 'integrante' : 'integrantes'} de esta familia. Organizador,
                  administradores y editores no aparecen en la lista: entran con su usuario y contraseña.
                </p>
              )}

              <a href={whatsappShareUrl(message)} target="_blank" rel="noopener noreferrer" className={buttonClasses('whatsapp', 'lg')}>
                <MessageCircle className="size-6" aria-hidden />
                <span>Enviar por WhatsApp</span>
              </a>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => copy(link, 'Enlace copiado.')} icon={<Copy className="size-5" aria-hidden />}>
                  Copiar enlace
                </Button>
                <Button variant="secondary" onClick={() => copy(message, 'Mensaje copiado. Pégalo en WhatsApp.')} icon={<Copy className="size-5" aria-hidden />}>
                  Copiar mensaje
                </Button>
                <Button variant="ghost" onClick={() => setEditing(true)} icon={<KeyRound className="size-5" aria-hidden />}>
                  Cambiar la palabra
                </Button>
              </div>
            </div>
          )
        )}
      </div>
    </Modal>
  );
}
