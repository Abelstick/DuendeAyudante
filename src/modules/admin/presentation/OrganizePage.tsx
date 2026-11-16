import { BellRing, CalendarDays, CalendarPlus, Camera, Check, ChevronRight, ClipboardPlus, ListChecks, Settings, Table2, Tv, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useEventScope } from '@/app/layout/EventLayout';
import { canManageEvent } from '@/modules/events/domain/Event';
import { DuplicateEventModal } from '@/modules/events/presentation/DuplicateEventModal';
import { RemindersPanel } from '@/modules/reminders/presentation/RemindersPanel';
import { AddressEditor } from './AddressEditor';
import { useFamilies } from '@/modules/families/presentation/hooks';
import { useMembers } from '@/modules/members/presentation/hooks';
import { formatEventDate } from '@/shared/lib/datetime';
import { ResponsibilityFormModal } from '@/modules/responsibilities/presentation/ResponsibilityFormModal';
import type { ResponsibilityKind } from '@/modules/responsibilities/domain/Responsibility';
import { Button, ButtonLink, Spinner } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { Card, CardTitle, Notice, PageTitle } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { TourButton } from '@/shared/ui/TourButton';
import type { TourStep } from '@/shared/tour/tour';
import { BudgetEditor } from './BudgetEditor';
import { DescriptionEditor } from './DescriptionEditor';
import { AddMemberForm } from './AddMemberForm';
import { BulkMembersModal } from './BulkMembersModal';
import { ChecklistManager } from './ChecklistManager';
import { JoinCodeEditor } from './JoinCodeEditor';
import { FamiliesManager } from './FamiliesManager';
import { FamilyDrivesManager } from './FamilyDrivesManager';
import { MembersList } from './MembersList';

/** Guía de Organizar: solo se abre si quien administra toca «¿Cómo se organiza una Navidad?». */
const ORGANIZE_TOUR: TourStep[] = [
  {
    title: 'Así se organiza una Navidad 🎄',
    text: 'Esta pantalla solo la ven quien organiza y los administradores. Te mostramos cada parte, de arriba hacia abajo. Puedes salir cuando quieras con la ✕.',
  },
  {
    target: 'organizar-datos',
    title: 'Los datos de la celebración',
    text: 'Aquí están el código para entrar, la fecha, el presupuesto del intercambio, la descripción y la dirección (con de quién es la casa). Toca «Cambiar» en el que quieras ajustar; todos lo verán en su inicio.',
  },
  {
    target: 'organizar-pasos',
    title: 'Los tres pasos para empezar',
    text: 'Primero creas las familias, luego agregas a tus familiares y al final compartes el enlace de cada familia. Lo que ya hiciste se marca en verde.',
  },
  {
    target: 'organizar-familias',
    title: '1. Familias',
    text: 'Crea una familia por cada grupo (por ejemplo «García» o «Los tíos») y elige su color. Desde aquí también obtienes el enlace de cada familia para enviarlo por WhatsApp: con ese enlace entran sin usuario ni contraseña.',
  },
  {
    target: 'organizar-fotos',
    title: 'Fotos de los regalos',
    text: 'Para que puedan subir fotos de sus regalos, conecta una carpeta de Google Drive. Es opcional: sin esto, los regalos se guardan igual, solo sin fotos.',
  },
  {
    target: 'organizar-familiares',
    title: '2. Familiares',
    text: 'Agrega a cada persona. Puede tener su propio usuario o no (por ejemplo, un niño pequeño). Con «Editar» corriges sus datos y eliges quién puede ayudarle con sus regalos desde su propia cuenta. Si alguien inhabilitó su cuenta, aquí aparece el botón «Reactivar cuenta».',
  },
  {
    target: 'organizar-tareas',
    title: 'Tareas y aportes',
    text: 'Reparte quién hace o lleva cada cosa: una tarea («poner la mesa») o un aporte («traer el panetón»). A cada persona le aparece en su inicio.',
  },
  {
    target: 'organizar-checklist',
    title: 'Checklist de preparación',
    text: 'La lista de cosas que cada quien debe tener listas antes de la celebración. Puede ser para todos, para una familia o para una sola persona.',
  },
  {
    target: 'organizar-recordatorios',
    title: 'Recordatorios por WhatsApp',
    text: 'Te muestra a quién le falta algo (su lista de regalos, una tarea) y te deja el mensaje listo para enviárselo por WhatsApp.',
  },
  {
    target: 'organizar-tele',
    title: 'Pantalla para la tele',
    text: 'El día de la celebración, ábrela en la tele: muestra la cuenta regresiva, la actividad que sigue y los avisos.',
  },
  {
    target: 'organizar-proximo',
    title: 'El próximo año',
    text: 'Cuando pase esta Navidad, crea la del año siguiente copiando familias, integrantes y más, sin empezar de cero.',
  },
];

/** Panel del organizador y administradores. */
export function OrganizePage() {
  const { event, context } = useEventScope();
  const families = useFamilies(event.id);
  const members = useMembers(event.id);
  const [editingBudget, setEditingBudget] = useState(false);
  const [adding, setAdding] = useState<'one' | 'many' | null>(null);
  const [assigning, setAssigning] = useState<{ kind: ResponsibilityKind; participantIds: string[] } | null>(null);
  const [duplicating, setDuplicating] = useState(false);

  if (!canManageEvent(context.role)) return <Navigate to={`/e/${event.id}`} replace />;
  if (families.isLoading || members.isLoading) return <Spinner label="Cargando…" />;
  if (families.error || members.error) return <Notice tone="error">{errorMessage(families.error ?? members.error)}</Notice>;

  const familyList = families.data ?? [];
  const memberList = members.data ?? [];
  const step = familyList.length === 0 ? 1 : memberList.length <= 1 ? 2 : 3;

  return (
    <div className="space-y-6">
      <PageTitle tone="gold" icon={<Settings className="size-8" aria-hidden />} title="Organizar" subtitle={event.name} />

      {/* Ayuda opcional para quien administra por primera vez */}
      <TourButton label="¿Cómo se organiza una Navidad? Te lo explicamos" steps={ORGANIZE_TOUR} />

      <Card data-tour="organizar-datos" className="space-y-3 border-2 border-gold-400! bg-gold-50">
        <JoinCodeEditor />
        <ul className="grid gap-2 sm:grid-cols-2">
          <li className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-base">
            <CalendarDays className="size-5 shrink-0 text-night-700" aria-hidden />
            <span className="first-letter:uppercase">{formatEventDate(event.celebrationAt, event.timezone)}</span>
          </li>
          {event.giftExchange && (
            <li className={editingBudget ? 'sm:col-span-2' : undefined}>
              <BudgetEditor budget={event.giftExchange.budgetMax} onEditingChange={setEditingBudget} />
            </li>
          )}
          <li className="sm:col-span-2">
            <DescriptionEditor />
          </li>
          <li className="sm:col-span-2">
            <AddressEditor />
          </li>
        </ul>
      </Card>

      <ol data-tour="organizar-pasos" className="grid gap-2 sm:grid-cols-3" aria-label="Pasos para empezar">
        {['Crea las familias', 'Agrega a tus familiares', 'Comparte el enlace de cada familia'].map((label, i) => (
          <li
            key={label}
            aria-current={i + 1 === step ? 'step' : undefined}
            className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-base font-bold ${
              i + 1 < step ? 'border-pine-600/30 bg-pine-100 text-pine-700' : i + 1 === step ? 'border-gold-400 bg-gold-100 text-ink-900' : 'border-mist-200 bg-white text-ink-700'
            }`}
          >
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-full text-base font-black ${
                i + 1 < step ? 'bg-pine-600 text-white' : i + 1 === step ? 'bg-gold-400 text-night-900' : 'bg-mist-200 text-ink-700'
              }`}
              aria-hidden
            >
              {i + 1 < step ? <Check className="size-5" strokeWidth={3} /> : i + 1}
            </span>
            <span className="sr-only">{i + 1 < step ? 'Hecho: ' : `Paso ${i + 1}: `}</span>
            {label}
          </li>
        ))}
      </ol>

      <section className="space-y-3">
        <div data-tour="organizar-familias">
          <CardTitle icon={<Users className="size-6" />}>Familias</CardTitle>
        </div>
        <FamiliesManager eventId={event.id} families={familyList} participants={memberList} />
      </section>

      <section id="fotos" className="scroll-mt-24 space-y-3">
        <div data-tour="organizar-fotos">
          <CardTitle icon={<Camera className="size-6" />} tone="berry">
            Fotos de los regalos (Google Drive)
          </CardTitle>
        </div>
        <FamilyDrivesManager eventId={event.id} families={familyList} />
      </section>

      <section className="space-y-4">
        <div data-tour="organizar-familiares">
          <CardTitle icon={<UserPlus className="size-6" />}>Familiares ({memberList.length})</CardTitle>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setAdding('one')} icon={<UserPlus className="size-5" aria-hidden />}>
            Agregar familiar
          </Button>
          {/* La tabla necesita espacio: solo se ofrece en pantallas grandes */}
          <span className="hidden md:inline">
            <Button variant="secondary" onClick={() => setAdding('many')} icon={<Table2 className="size-5" aria-hidden />}>
              Agregar varios en una tabla
            </Button>
          </span>
        </div>
        <MembersList
          members={memberList}
          families={familyList}
          myRole={context.role}
          onAssignTask={(m) => setAssigning({ kind: 'task', participantIds: [m.id] })}
        />
      </section>

      <section data-tour="organizar-tareas" className="space-y-3">
        <CardTitle icon={<ClipboardPlus className="size-6" />}>Tareas y aportes</CardTitle>
        <p className="text-base text-ink-700">
          Reparte quién hace o lleva cada cosa. A cada persona le aparece en su inicio, en «Mis responsabilidades», y la marca cuando la cumple.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setAssigning({ kind: 'task', participantIds: [] })} icon={<ClipboardPlus className="size-5" aria-hidden />}>
            Asignar una tarea
          </Button>
          <Button variant="secondary" onClick={() => setAssigning({ kind: 'contribution', participantIds: [] })} icon={<ClipboardPlus className="size-5" aria-hidden />}>
            Asignar un aporte
          </Button>
          <ButtonLink to={`/e/${event.id}/celebracion`} variant="ghost" icon={<ChevronRight className="size-5" aria-hidden />}>
            Ver todas
          </ButtonLink>
        </div>
      </section>

      <section className="space-y-3">
        <div data-tour="organizar-checklist">
          <CardTitle icon={<ListChecks className="size-6" />}>Checklist de preparación</CardTitle>
        </div>
        <ChecklistManager eventId={event.id} families={familyList} members={memberList} />
      </section>

      <section className="space-y-3">
        <div data-tour="organizar-recordatorios">
          <CardTitle icon={<BellRing className="size-6" />} tone="berry">
            Recordatorios por WhatsApp
          </CardTitle>
        </div>
        <RemindersPanel members={memberList} />
      </section>

      <section data-tour="organizar-tele" className="space-y-3">
        <CardTitle icon={<Tv className="size-6" />} tone="night">
          Pantalla para la tele
        </CardTitle>
        <p className="text-base text-ink-700">
          Ábrela en la tele o en una computadora conectada: muestra la cuenta regresiva, qué actividad sigue y los avisos. Se actualiza sola.
        </p>
        <ButtonLink to={`/e/${event.id}/tv`} variant="secondary" icon={<Tv className="size-5" aria-hidden />}>
          Abrir pantalla para la tele
        </ButtonLink>
      </section>

      {context.role === 'owner' && (
        <section data-tour="organizar-proximo" className="space-y-3">
          <CardTitle icon={<CalendarPlus className="size-6" />} tone="gold">
            El próximo año
          </CardTitle>
          <p className="text-base text-ink-700">Crea la Navidad del año que viene copiando familias, integrantes, checklist y más.</p>
          <Button variant="gold" onClick={() => setDuplicating(true)} icon={<CalendarPlus className="size-5" aria-hidden />}>
            Crear la Navidad del próximo año
          </Button>
        </section>
      )}

      {duplicating && <DuplicateEventModal event={event} onClose={() => setDuplicating(false)} />}

      {adding === 'one' && (
        <Modal open title="Agregar a un familiar" onClose={() => setAdding(null)}>
          <AddMemberForm families={familyList} members={memberList} myRole={context.role} />
        </Modal>
      )}
      {adding === 'many' && <BulkMembersModal families={familyList} members={memberList} onClose={() => setAdding(null)} />}

      {assigning && (
        <ResponsibilityFormModal
          key={`${assigning.kind}-${assigning.participantIds.join()}`}
          eventId={event.id}
          initial={null}
          defaultKind={assigning.kind}
          families={familyList}
          participants={memberList.filter((m) => m.status === 'active')}
          initialParticipantIds={assigning.participantIds}
          onClose={() => setAssigning(null)}
        />
      )}
    </div>
  );
}
