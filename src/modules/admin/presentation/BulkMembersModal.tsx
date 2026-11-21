import { Check, Copy, MessageCircle, Plus, RefreshCw, Trash2, UsersRound } from 'lucide-react';
import { useMemo, useRef, useState, type ClipboardEvent } from 'react';
import { useEventScope } from '@/app/layout/EventLayout';
import type { Family } from '@/modules/families/domain/Family';
import type { Member } from '@/modules/members/domain/Participant';
import { useAccessMessage, useMemberMutations } from '@/modules/members/presentation/hooks';
import { whatsappShareUrl } from '@/shared/lib/whatsapp';
import { Button, buttonClasses } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { Modal } from '@/shared/ui/Modal';
import { useToast } from '@/shared/ui/Toast';
import { fullName, generateFriendlyPassword, isValidPersonName, suggestUsername, toTitleCase, USERNAME_PATTERN } from '@/shared/validation/names';

interface Row {
  key: number;
  firstName: string;
  paternal: string;
  maternal: string;
  familyId: string;
  /** Vacío = usar el usuario sugerido. */
  username: string;
  password: string;
  status: 'idle' | 'saving' | 'ok' | 'error';
  error?: string;
  /** Usuario con el que quedó creado (puede llevar un número si ya existía). */
  createdUsername?: string;
}

const INITIAL_ROWS = 5;
const MAX_ROWS = 40;

interface Props {
  families: Family[];
  members: Member[];
  onClose: () => void;
}

/**
 * Crear varios familiares a la vez en una tabla (pensado para computadora).
 * Solo hacen falta nombre y apellido: el usuario y la contraseña se proponen solos
 * y la familia es opcional (se puede elegir después en la lista de familiares).
 * Todos se crean como participantes, usando el mismo servicio que el formulario individual.
 */
export function BulkMembersModal({ families, members, onClose }: Props) {
  const { event } = useEventScope();
  const { add } = useMemberMutations(event.id);
  const buildMessage = useAccessMessage();
  const toast = useToast();
  const nextKey = useRef(INITIAL_ROWS);
  const newRow = (key: number, over: Partial<Row> = {}): Row => ({
    key,
    firstName: '',
    paternal: '',
    maternal: '',
    familyId: '',
    username: '',
    password: generateFriendlyPassword(),
    status: 'idle',
    ...over,
  });
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: INITIAL_ROWS }, (_, i) => newRow(i)));
  const [running, setRunning] = useState(false);

  const isEmpty = (r: Row) => !r.firstName.trim() && !r.paternal.trim() && !r.maternal.trim();

  /** Usuario de cada fila: el escrito o uno sugerido que no choque con los existentes ni con filas anteriores. */
  const usernames = useMemo(() => {
    const taken = new Set(members.map((m) => m.username).filter((u): u is string => Boolean(u)));
    const result = new Map<number, string>();
    for (const r of rows) {
      const value = r.createdUsername ?? (r.username.trim().toLowerCase() || (isEmpty(r) ? '' : suggestUsername(r.firstName, r.paternal, taken)));
      if (value) taken.add(value);
      result.set(r.key, value);
    }
    return result;
  }, [rows, members]);

  const validate = (r: Row): string | null => {
    if (!isValidPersonName(r.firstName)) return 'Escribe el nombre usando solo letras.';
    if (!isValidPersonName(r.paternal)) return 'Escribe el apellido paterno usando solo letras.';
    if (r.maternal.trim() && !isValidPersonName(r.maternal)) return 'El apellido materno solo lleva letras.';
    if (!USERNAME_PATTERN.test(usernames.get(r.key) ?? '')) return 'El usuario debe tener de 2 a 30 letras o números, sin espacios.';
    if (r.password.length < 8) return 'La contraseña necesita al menos 8 caracteres.';
    return null;
  };

  const patch = (key: number, over: Partial<Row>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...over } : r)));
  const addRow = () => setRows((list) => (list.length >= MAX_ROWS ? list : [...list, newRow(nextKey.current++)]));
  const removeRow = (key: number) => setRows((list) => (list.length <= 1 ? list : list.filter((r) => r.key !== key)));

  /** Pegar desde Excel o una lista: columnas Nombre, Apellido paterno, Apellido materno. */
  const onPaste = (e: ClipboardEvent<HTMLInputElement>, rowKey: number) => {
    const text = e.clipboardData.getData('text');
    if (!/[\t\n]/.test(text)) return;
    e.preventDefault();
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.split('\t').map((c) => c.trim()))
      .filter((cells) => cells.some(Boolean));
    setRows((list) => {
      const start = list.findIndex((r) => r.key === rowKey);
      const next = [...list];
      lines.forEach((cells, i) => {
        const index = start + i;
        if (index >= MAX_ROWS) return;
        const base = next[index] ?? newRow(nextKey.current++);
        if (base.status === 'ok') return;
        next[index] = { ...base, firstName: cells[0] ?? '', paternal: cells[1] ?? '', maternal: cells[2] ?? '', status: 'idle', error: undefined };
      });
      return next;
    });
  };

  const pending = rows.filter((r) => !isEmpty(r) && r.status !== 'ok');
  const created = rows.filter((r) => r.status === 'ok');

  const createAll = async () => {
    // Primero se revisa todo: si una fila tiene un error, se marca y no se envía
    const checked = rows.map((r) => {
      if (isEmpty(r) || r.status === 'ok') return r;
      const error = validate(r);
      return error ? { ...r, status: 'error' as const, error } : { ...r, status: 'idle' as const, error: undefined };
    });
    setRows(checked);
    const toCreate = checked.filter((r) => !isEmpty(r) && r.status === 'idle');
    if (toCreate.length === 0) return;

    setRunning(true);
    let ok = 0;
    for (const r of toCreate) {
      patch(r.key, { status: 'saving' });
      try {
        const result = await add.mutateAsync({
          eventId: event.id,
          firstName: r.firstName,
          paternalSurname: r.paternal,
          maternalSurname: r.maternal || null,
          distinguishingNote: null,
          familyId: r.familyId || null,
          role: 'participant',
          account: { username: usernames.get(r.key) ?? '', password: r.password, autoSuffix: !r.username.trim() },
          guardianParticipantIds: [],
        });
        patch(r.key, { status: 'ok', error: undefined, createdUsername: result.username ?? usernames.get(r.key) });
        ok++;
      } catch (err) {
        patch(r.key, { status: 'error', error: errorMessage(err) });
      }
    }
    setRunning(false);
    if (ok > 0) toast.celebrate(ok === 1 ? '¡1 familiar creado!' : `¡${ok} familiares creados!`);
    if (ok < toCreate.length) toast.error('Algunas filas no se pudieron crear. Revisa los mensajes en rojo.');
  };

  const messageFor = (r: Row) =>
    buildMessage({
      firstName: toTitleCase(r.firstName),
      eventName: event.name,
      joinCode: event.joinCode,
      appUrl: window.location.origin,
      username: r.createdUsername ?? '',
      password: r.password,
    });

  const copyAll = async () => {
    const text = [
      `Código de la Navidad: ${event.joinCode}`,
      ...created.map((r) => `${fullName(r.firstName, r.paternal, r.maternal)}\t${r.createdUsername}\t${r.password}`),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Accesos copiados. Pégalos en una hoja de cálculo o en tus notas.');
    } catch {
      toast.error('No se pudo copiar. Selecciona el texto y cópialo a mano.');
    }
  };

  const cell = 'min-h-11 w-full rounded-lg border-2 border-line bg-surface px-2.5 text-base text-ink-900 focus:outline-none focus:ring-4 focus:ring-aqua-400 disabled:border-mist-300 disabled:bg-mist-100 disabled:text-ink-700';

  return (
    <Modal
      open
      size="wide"
      title="Agregar varios familiares"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={createAll} loading={running} disabled={pending.length === 0} icon={<UsersRound className="size-5" aria-hidden />}>
            {pending.length === 0 ? 'Crear familiares' : pending.length === 1 ? 'Crear 1 familiar' : `Crear ${pending.length} familiares`}
          </Button>
          {created.length > 0 && (
            <Button variant="secondary" onClick={copyAll} icon={<Copy className="size-5" aria-hidden />}>
              Copiar los {created.length} accesos
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            {created.length > 0 ? 'Listo, cerrar' : 'Cancelar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-base text-ink-700">
          Escribe un familiar por fila. Solo hacen falta el <strong>nombre</strong> y el <strong>apellido paterno</strong>: el usuario y la contraseña se proponen
          solos y la familia es opcional. También puedes <strong>pegar una lista desde Excel</strong> (nombre, apellido paterno, apellido materno).
        </p>

        {families.length > 0 && (
          <label className="flex flex-wrap items-center gap-2 text-base font-bold">
            Poner la misma familia a todas las filas:
            <select
              className={`${cell} max-w-64`}
              value=""
              onChange={(e) => {
                const value = e.target.value === 'none' ? '' : e.target.value;
                if (e.target.value) setRows((list) => list.map((r) => (r.status === 'ok' ? r : { ...r, familyId: value })));
              }}
            >
              <option value="">Elegir…</option>
              <option value="none">Sin familia</option>
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {created.length > 0 && (
          <Notice tone="warning">
            Guarda o envía las contraseñas ahora: por seguridad no se volverán a mostrar al cerrar esta ventana. Si alguna se pierde, puedes crear una nueva desde
            la lista de familiares.
          </Notice>
        )}

        <div className="relative overflow-x-auto rounded-xl border-2 border-line">
          <table className="w-full min-w-[60rem] border-collapse text-left">
            <thead className="bg-night-800 text-white">
              <tr className="eyebrow">
                <th scope="col" className="w-10 px-2 py-3 text-center">
                  N.º
                </th>
                <th scope="col" className="px-2 py-3">
                  Nombre
                </th>
                <th scope="col" className="px-2 py-3">
                  Apellido paterno
                </th>
                <th scope="col" className="px-2 py-3">
                  Apellido materno <span className="normal-case tracking-normal opacity-80">(opcional)</span>
                </th>
                {families.length > 0 && (
                  <th scope="col" className="min-w-40 px-2 py-3">
                    Familia <span className="normal-case tracking-normal opacity-80">(opcional)</span>
                  </th>
                )}
                <th scope="col" className="px-2 py-3">
                  Usuario
                </th>
                <th scope="col" className="px-2 py-3">
                  Contraseña
                </th>
                <th scope="col" className="w-44 px-2 py-3">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const locked = r.status === 'ok' || r.status === 'saving';
                const n = i + 1;
                return (
                  <tr key={r.key} className={`border-t-2 border-mist-200 align-top ${r.status === 'ok' ? 'bg-pine-50' : r.status === 'error' ? 'bg-berry-50' : 'bg-surface'}`}>
                    <td className="px-2 py-3 text-center font-bold text-ink-500">{n}</td>
                    <td className="p-1.5">
                      <input
                        className={cell}
                        aria-label={`Nombre, fila ${n}`}
                        autoComplete="off"
                        autoFocus={i === 0}
                        disabled={locked}
                        value={r.firstName}
                        onPaste={(e) => onPaste(e, r.key)}
                        onChange={(e) => patch(r.key, { firstName: e.target.value, status: 'idle', error: undefined })}
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        className={cell}
                        aria-label={`Apellido paterno, fila ${n}`}
                        autoComplete="off"
                        disabled={locked}
                        value={r.paternal}
                        onChange={(e) => patch(r.key, { paternal: e.target.value, status: 'idle', error: undefined })}
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        className={cell}
                        aria-label={`Apellido materno, fila ${n}`}
                        autoComplete="off"
                        disabled={locked}
                        value={r.maternal}
                        onChange={(e) => patch(r.key, { maternal: e.target.value, status: 'idle', error: undefined })}
                      />
                    </td>
                    {families.length > 0 && (
                      <td className="p-1.5">
                        <select className={cell} aria-label={`Familia, fila ${n}`} disabled={locked} value={r.familyId} onChange={(e) => patch(r.key, { familyId: e.target.value })}>
                          <option value="">Sin familia</option>
                          {families.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td className="p-1.5">
                      <input
                        className={cell}
                        aria-label={`Usuario, fila ${n}`}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        disabled={locked}
                        placeholder={usernames.get(r.key) || 'se propone solo'}
                        value={r.createdUsername ?? r.username}
                        onChange={(e) => patch(r.key, { username: e.target.value, status: 'idle', error: undefined })}
                      />
                    </td>
                    <td className="p-1.5">
                      <div className="flex gap-1.5">
                        <input
                          className={cell}
                          aria-label={`Contraseña, fila ${n}`}
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          disabled={locked}
                          value={r.password}
                          onChange={(e) => patch(r.key, { password: e.target.value, status: 'idle', error: undefined })}
                        />
                        {!locked && (
                          <button
                            type="button"
                            className="flex size-11 shrink-0 items-center justify-center rounded-lg border-2 border-line bg-surface text-heading hover:bg-brand-soft"
                            aria-label={`Generar otra contraseña, fila ${n}`}
                            title="Generar otra contraseña"
                            onClick={() => patch(r.key, { password: generateFriendlyPassword() })}
                          >
                            <RefreshCw className="size-5" aria-hidden />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-sm">
                      {r.status === 'ok' && (
                        <div className="space-y-1.5">
                          <p className="flex items-center gap-1 font-bold text-pine-700">
                            <Check className="size-5" strokeWidth={3} aria-hidden /> Creado
                          </p>
                          <a href={whatsappShareUrl(messageFor(r))} target="_blank" rel="noopener noreferrer" className={buttonClasses('whatsapp', 'md', 'min-h-10! px-2.5! text-sm!')}>
                            <MessageCircle className="size-4" aria-hidden />
                            <span>Enviar acceso</span>
                          </a>
                        </div>
                      )}
                      {r.status === 'saving' && <p className="font-bold text-ink-700">Creando…</p>}
                      {r.status === 'error' && (
                        <p role="alert" className="font-bold text-berry-700">
                          {r.error}
                        </p>
                      )}
                      {r.status === 'idle' && (
                        <button
                          type="button"
                          className="flex min-h-10 items-center gap-1 rounded-lg px-2 font-bold text-berry-700 hover:bg-berry-50 disabled:opacity-40"
                          disabled={rows.length <= 1}
                          onClick={() => removeRow(r.key)}
                          aria-label={`Quitar la fila ${n}`}
                        >
                          <Trash2 className="size-4" aria-hidden /> Quitar fila
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Button variant="secondary" onClick={addRow} disabled={rows.length >= MAX_ROWS} icon={<Plus className="size-5" aria-hidden />}>
          Agregar otra fila
        </Button>
      </div>
    </Modal>
  );
}
