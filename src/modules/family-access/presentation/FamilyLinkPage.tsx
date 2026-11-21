import { ArrowLeft, ChevronRight, KeyRound, LogIn, Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/app/AuthContext';
import { useServices } from '@/app/ContainerContext';
import { FullPageSpinner } from '@/app/layout/FullPageSpinner';
import { PublicLayout } from '@/app/layout/PublicLayout';
import { FAMILY_COLORS } from '@/modules/families/presentation/familyTheme';
import { isAppError } from '@/shared/domain/errors';
import { Avatar } from '@/shared/ui/Avatar';
import { Button, ButtonLink, Spinner } from '@/shared/ui/Button';
import { Card, Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { TextField } from '@/shared/ui/TextField';
import type { FamilyLinkMember } from '../domain/FamilyAccess';
import { useFamilyLinkInfo } from './hooks';

/**
 * "/f/:token" — entrada con el enlace de la familia, pensada para personas mayores:
 *   1) escribir la palabra secreta   2) tocar su nombre   → adentro.
 * El teléfono recuerda la sesión, así que no se repite la próxima vez.
 */
export function FamilyLinkPage() {
  const { token = '' } = useParams();
  const { familyAccess, auth } = useServices();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const info = useFamilyLinkInfo(token);

  const [word, setWord] = useState('');
  const [members, setMembers] = useState<FamilyLinkMember[] | null>(null);
  const [search, setSearch] = useState('');
  const [checking, setChecking] = useState(false);
  const [enteringId, setEnteringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (loading || info.isLoading) return <FullPageSpinner />;
  // Quien ya tiene sesión en este teléfono va directo a su Navidad
  if (user && !enteringId) return <Navigate to="/" replace />;

  if (info.error || !info.data) {
    const notFound = isAppError(info.error) && info.error.code === 'FAMILY_LINK_NOT_FOUND';
    return (
      <PublicLayout>
        <Card className="space-y-4">
          <h1 className="text-2xl font-extrabold text-heading">{notFound ? 'Este enlace no es válido' : 'No pudimos abrir el enlace'}</h1>
          <Notice tone="error">{errorMessage(info.error)}</Notice>
          <ButtonLink to="/entrar" variant="secondary" size="lg" icon={<LogIn className="size-6" aria-hidden />}>
            Entrar con usuario y contraseña
          </ButtonLink>
        </Card>
      </PublicLayout>
    );
  }

  const color = FAMILY_COLORS[info.data.familyColor] ?? FAMILY_COLORS.green;

  const checkWord = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setChecking(true);
    try {
      setMembers(await familyAccess.listMembers(token, word));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setChecking(false);
    }
  };

  const enter = async (member: FamilyLinkMember) => {
    setError(null);
    setEnteringId(member.participantId);
    try {
      const pass = await familyAccess.enter(token, word, member.participantId);
      await auth.signInWithPass(pass);
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setEnteringId(null);
    }
  };

  // Búsqueda sin importar tildes ni mayúsculas: "jose" encuentra a "JOSÉ"
  const plain = (v: string) => v.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const visible = (members ?? []).filter((m) => !search.trim() || plain(m.name).includes(plain(search.trim())));

  return (
    <PublicLayout>
      <Card className="space-y-5">
        <header className="space-y-2">
          <p className="eyebrow text-ink-500">{info.data.eventName}</p>
          <p className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-lg font-extrabold" style={{ backgroundColor: color.soft, color: color.text }}>
            <span className="size-4 rounded-full border-2 border-white" style={{ backgroundColor: color.swatch }} aria-hidden />
            Familia {info.data.familyName}
          </p>
        </header>

        {members === null ? (
          // Paso 1 · la palabra secreta
          <form onSubmit={checkWord} className="space-y-5" noValidate>
            <h1 className="text-[1.7rem] font-extrabold leading-tight text-heading">Escribe la palabra secreta</h1>
            <TextField
              label="Palabra secreta"
              hint="Está en el mensaje de WhatsApp que te enviaron. No importa si la escribes en minúsculas."
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="text-center text-2xl font-extrabold uppercase tracking-widest"
              value={word}
              onChange={(e) => setWord(e.target.value)}
            />
            {error && <Notice tone="error">{error}</Notice>}
            <Button type="submit" size="lg" loading={checking} disabled={!word.trim()} icon={<KeyRound className="size-6" aria-hidden />}>
              Continuar
            </Button>
          </form>
        ) : (
          // Paso 2 · ¿quién eres?
          <div className="space-y-4">
            <h1 className="text-[1.7rem] font-extrabold leading-tight text-heading">¿Quién eres?</h1>
            <p className="text-lg text-ink-700">Toca tu nombre para entrar.</p>

            {members.length > 6 && (
              <TextField
                label="Busca tu nombre"
                type="search"
                placeholder="Escribe tu nombre"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                trailing={<Search className="mt-3.5 size-6 shrink-0 text-ink-500" aria-hidden />}
              />
            )}

            {error && <Notice tone="error">{error}</Notice>}

            {members.length === 0 ? (
              <Notice tone="warning">Todavía no hay nadie de esta familia en la lista. Avísale a quien organiza tu Navidad.</Notice>
            ) : visible.length === 0 ? (
              <Notice>No encontramos ese nombre. Revisa cómo lo escribiste.</Notice>
            ) : (
              <ul className="stagger space-y-2.5">
                {visible.map((m) => (
                  <li key={m.participantId}>
                    <button
                      type="button"
                      onClick={() => enter(m)}
                      disabled={enteringId !== null}
                      className="btn-3d flex min-h-16 w-full items-center gap-3 rounded-xl border-2 border-line bg-surface px-4 py-2 text-left hover:bg-brand-soft disabled:opacity-60"
                    >
                      <Avatar name={m.name} colors={{ bg: color.soft, fg: color.text }} />
                      <span className="font-display min-w-0 flex-1 text-xl font-bold leading-tight text-heading">{m.name}</span>
                      {enteringId === m.participantId ? <Spinner /> : <ChevronRight className="size-6 shrink-0 text-heading" aria-hidden />}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <Button
              variant="ghost"
              onClick={() => {
                setMembers(null);
                setSearch('');
                setError(null);
              }}
              icon={<ArrowLeft className="size-5" aria-hidden />}
            >
              Volver a escribir la palabra
            </Button>
          </div>
        )}
      </Card>

      <p className="mt-6 text-center text-base text-ink-700">
        ¿No encuentras tu nombre o eres quien organiza?{' '}
        <Link to="/entrar" className="font-bold text-brand-ink underline underline-offset-4">
          Entra con tu usuario y contraseña
        </Link>
        .
      </p>
    </PublicLayout>
  );
}
