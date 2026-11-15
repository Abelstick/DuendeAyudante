/**
 * Pruebas de la base de datos sin Docker: ejecuta las migraciones reales en
 * PGlite (PostgreSQL compilado a WebAssembly) con un esquema `auth` simulado,
 * y verifica normalización, restricciones y políticas RLS por rol.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'migrations');

/** Simula lo mínimo que Supabase provee: roles, auth.users y auth.uid(). */
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_app_meta_data jsonb not null default '{}'::jsonb,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`;

let db: PGlite;

const ids = {
  ownerA: '00000000-0000-0000-0000-00000000000a',
  rosa: '00000000-0000-0000-0000-0000000000b1', // participante del evento A
  papa: '00000000-0000-0000-0000-0000000000b2', // tutor en el evento A
  editor: '00000000-0000-0000-0000-0000000000b3',
  ownerB: '00000000-0000-0000-0000-00000000000c',
};
let eventA = '';
let eventB = '';
const participant: Record<string, string> = {};

/** Ejecuta `fn` como un usuario autenticado (RLS activa). */
async function as<T>(userId: string, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId]);
    await tx.exec('set local role authenticated');
    return fn(tx);
  });
}

/** Simula lo que hace la Edge Function create-member (con service role). */
async function createMember(opts: {
  userId: string | null;
  username?: string;
  eventId: string;
  first: string;
  paternal: string;
  role?: 'admin' | 'editor' | 'participant';
}): Promise<string> {
  if (opts.userId) {
    await db.query(
      `insert into auth.users (id, email, raw_app_meta_data) values ($1, $2, $3)`,
      [
        opts.userId,
        `${opts.username}@${opts.eventId}.miembros.test`,
        { created_by: 'admin', username: opts.username, created_in_event_id: opts.eventId },
      ],
    );
  }
  const res = await db.query<{ id: string }>(
    `insert into public.participants (event_id, user_id, first_name, paternal_surname)
     values ($1, $2, $3, $4) returning id`,
    [opts.eventId, opts.userId, opts.first, opts.paternal],
  );
  if (opts.userId) {
    await db.query(`insert into public.event_members (event_id, user_id, role) values ($1, $2, $3)`, [
      opts.eventId,
      opts.userId,
      opts.role ?? 'participant',
    ]);
  }
  return res.rows[0]!.id;
}

async function expectDenied(promise: Promise<unknown>) {
  await expect(promise).rejects.toThrow(/row-level security|permission denied|FORBIDDEN|NOT_A_MEMBER/);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }

  // Dos organizadores que se registran con correo
  for (const [id, email] of [
    [ids.ownerA, 'abel@example.com'],
    [ids.ownerB, 'otra@example.com'],
  ]) {
    await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, email]);
  }

  eventA = await as(ids.ownerA, async (tx) => {
    const r = await tx.query<{ create_event: string }>(
      `select public.create_event('Navidad García', 'garcía 25', '2026-12-24 19:00-05', '  abel ', 'pérez', null) as create_event`,
    );
    return r.rows[0]!.create_event;
  });
  eventB = await as(ids.ownerB, async (tx) => {
    const r = await tx.query<{ create_event: string }>(
      `select public.create_event('Navidad López', 'LOPEZ', '2026-12-24 20:00-05', 'Ana', 'López') as create_event`,
    );
    return r.rows[0]!.create_event;
  });

  participant.rosa = await createMember({ userId: ids.rosa, username: 'rosa', eventId: eventA, first: 'rosa', paternal: 'garcía' });
  participant.papa = await createMember({ userId: ids.papa, username: 'juan', eventId: eventA, first: 'Juan', paternal: 'Pérez' });
  participant.editor = await createMember({ userId: ids.editor, username: 'lucia', eventId: eventA, first: 'Lucía', paternal: 'Díaz', role: 'editor' });
  participant.nino = await createMember({ userId: null, eventId: eventA, first: 'pedrito', paternal: 'pérez' });
  await db.query(
    `insert into public.guardianships (event_id, guardian_participant_id, ward_participant_id) values ($1, $2, $3)`,
    [eventA, participant.papa, participant.nino],
  );
});

describe('normalización de nombres', () => {
  it.each([
    ['hugo', 'HUGO'],
    ['  hugo  ', 'HUGO'],
    ['hUGo garcía', 'HUGO GARCÍA'],
    ['María   López', 'MARÍA LÓPEZ'],
    ['josé pérez', 'JOSÉ PÉREZ'],
    ['peña  ñuñez', 'PEÑA ÑUÑEZ'],
    ['   ', null],
  ])('%j → %j', async (input, expected) => {
    const r = await db.query<{ n: string | null }>(`select app.normalize_name($1) as n`, [input]);
    expect(r.rows[0]!.n).toBe(expected);
  });

  it('el trigger normaliza al guardar y arma el nombre completo', async () => {
    const r = await db.query<{ full_name: string }>(`select full_name from public.participants where id = $1`, [participant.rosa]);
    expect(r.rows[0]!.full_name).toBe('ROSA GARCÍA');
  });

  it('rechaza nombres con números o vacíos', async () => {
    await expect(
      db.query(`insert into public.participants (event_id, first_name, paternal_surname) values ($1, 'Hugo2', 'García')`, [eventA]),
    ).rejects.toThrow(/FIRST_NAME_INVALID/);
    await expect(
      db.query(`insert into public.participants (event_id, first_name, paternal_surname) values ($1, '   ', 'García')`, [eventA]),
    ).rejects.toThrow(/FIRST_NAME_INVALID/);
  });

  it('impide duplicados exactos en el evento, pero permite diferenciarlos', async () => {
    await expect(
      db.query(`insert into public.participants (event_id, first_name, paternal_surname) values ($1, ' ROSA ', 'garcía')`, [eventA]),
    ).rejects.toThrow(/participants_unique_name/);
    await db.query(
      `insert into public.participants (event_id, first_name, paternal_surname, distinguishing_note) values ($1, 'rosa', 'garcía', 'hija')`,
      [eventA],
    );
    // En otro evento sí puede existir el mismo nombre
    await db.query(`insert into public.participants (event_id, first_name, paternal_surname) values ($1, 'rosa', 'garcía')`, [eventB]);
  });
});

describe('creación de evento', () => {
  it('el organizador queda como owner, con perfil, intercambio de S/ 65 y usuario técnico', async () => {
    const r = await db.query<{ role: string; budget: string; organizer: string; username: string }>(
      `select m.role, x.budget_max::text as budget, e.organizer_name as organizer, u.username
       from public.events e
       join public.event_members m on m.event_id = e.id
       join public.gift_exchanges x on x.event_id = e.id
       join public.users u on u.id = m.user_id
       where e.id = $1`,
      [eventA],
    );
    expect(r.rows[0]!).toMatchObject({ role: 'owner', budget: '65.00', organizer: 'ABEL PÉREZ' });
    expect(r.rows[0]!.username).toMatch(/^org-/);
  });

  it('las cuentas creadas por el admin usan el usuario elegido', async () => {
    const r = await db.query<{ username: string; real_email: string | null }>(
      `select username, real_email from public.users where id = $1`,
      [ids.rosa],
    );
    expect(r.rows[0]!).toEqual({ username: 'rosa', real_email: null });
  });
});

describe('código de la Navidad y usuarios por Navidad', () => {
  it('normaliza el código: mayúsculas, sin tildes ni espacios', async () => {
    const r = await db.query<{ join_code: string }>(`select join_code from public.events where id = $1`, [eventA]);
    expect(r.rows[0]!.join_code).toBe('GARCIA25');
  });

  it('no permite repetir el código ni códigos inválidos', async () => {
    await expect(
      as(ids.ownerB, (tx) => tx.query(`select public.create_event('Otra', 'García-25', '2026-12-24 19:00-05', 'Ana', 'López')`)),
    ).rejects.toThrow(/JOIN_CODE_TAKEN/);
    await expect(
      as(ids.ownerB, (tx) => tx.query(`select public.create_event('Otra', 'ab', '2026-12-24 19:00-05', 'Ana', 'López')`)),
    ).rejects.toThrow(/JOIN_CODE_INVALID/);
    const free = await as(ids.ownerB, (tx) =>
      tx.query<{ a: boolean; b: boolean }>(`select public.is_join_code_available('garcia 25') as a, public.is_join_code_available('NUEVO1') as b`),
    );
    expect(free.rows[0]).toEqual({ a: false, b: true });
  });

  it('el mismo usuario puede existir en dos Navidades, pero no dos veces en la misma', async () => {
    await createMember({ userId: '00000000-0000-0000-0000-0000000000d1', username: 'rosa', eventId: eventB, first: 'Rosa', paternal: 'López' });
    await expect(
      createMember({ userId: '00000000-0000-0000-0000-0000000000d2', username: 'rosa', eventId: eventA, first: 'Rosa', paternal: 'Díaz' }),
    ).rejects.toThrow(/users_username_per_event/);
  });

  it('el organizador no puede cambiar el código (ya está en los mensajes enviados)', async () => {
    await expectDenied(as(ids.ownerA, (tx) => tx.query(`update public.events set join_code = 'OTRO' where id = $1`, [eventA])));
  });
});

describe('cambio de código de la Navidad', () => {
  const asRole = <T,>(role: 'anon' | 'service_role', fn: (tx: Transaction) => Promise<T>) =>
    db.transaction(async (tx) => {
      await tx.exec(`set local role ${role}`);
      return fn(tx);
    });

  it('resolve_join_code funciona sin sesión y normaliza lo que se escribe', async () => {
    const r = await asRole('anon', (tx) => tx.query<{ c: string | null }>(`select public.resolve_join_code(' garcía-25 ') as c`));
    expect(r.rows[0]!.c).toBe('GARCIA25');
    const none = await asRole('anon', (tx) => tx.query<{ c: string | null }>(`select public.resolve_join_code('NOEXISTE') as c`));
    expect(none.rows[0]!.c).toBeNull();
  });

  it('solo el servidor puede aplicar el cambio', async () => {
    await expectDenied(as(ids.ownerA, (tx) => tx.query(`select public.apply_join_code_change($1, 'FAMILIA', $2)`, [eventA, ids.ownerA])));
  });

  it('el código anterior sigue llevando a la Navidad y nadie más puede usarlo', async () => {
    await asRole('service_role', (tx) => tx.query(`select public.apply_join_code_change($1, 'FAMILIA', $2)`, [eventA, ids.ownerA]));
    const current = await db.query<{ join_code: string }>(`select join_code from public.events where id = $1`, [eventA]);
    expect(current.rows[0]!.join_code).toBe('FAMILIA');

    const viaOld = await asRole('anon', (tx) => tx.query<{ c: string }>(`select public.resolve_join_code('GARCIA25') as c`));
    expect(viaOld.rows[0]!.c).toBe('FAMILIA');

    const free = await as(ids.ownerB, (tx) => tx.query<{ ok: boolean }>(`select public.is_join_code_available('GARCIA25') as ok`));
    expect(free.rows[0]!.ok).toBe(false);
    await expect(
      as(ids.ownerB, (tx) => tx.query(`select public.create_event('Otra', 'GARCIA25', '2026-12-24 19:00-05', 'Ana', 'López')`)),
    ).rejects.toThrow(/JOIN_CODE_TAKEN/);
  });

  it('no permite tomar el código de otra Navidad, pero sí volver al propio código anterior', async () => {
    await expect(
      asRole('service_role', (tx) => tx.query(`select public.apply_join_code_change($1, 'LOPEZ', $2)`, [eventA, ids.ownerA])),
    ).rejects.toThrow(/JOIN_CODE_TAKEN/);
    await asRole('service_role', (tx) => tx.query(`select public.apply_join_code_change($1, 'GARCIA25', $2)`, [eventA, ids.ownerA]));
    const back = await db.query<{ join_code: string }>(`select join_code from public.events where id = $1`, [eventA]);
    expect(back.rows[0]!.join_code).toBe('GARCIA25');
    const viaFamilia = await asRole('anon', (tx) => tx.query<{ c: string }>(`select public.resolve_join_code('FAMILIA') as c`));
    expect(viaFamilia.rows[0]!.c).toBe('GARCIA25');
  });

  it('acepta el color blanco para las familias', async () => {
    await as(ids.ownerA, (tx) => tx.query(`insert into public.families (event_id, name, color_key) values ($1, 'NIEVE', 'white')`, [eventA]));
    await expect(
      as(ids.ownerA, (tx) => tx.query(`insert into public.families (event_id, name, color_key) values ($1, 'X', 'black')`, [eventA])),
    ).rejects.toThrow(/families_color_key_check/);
    await db.query(`delete from public.families where name = 'NIEVE'`);
  });
});

describe('RLS: aislamiento entre eventos', () => {
  it('un participante solo ve su evento', async () => {
    const r = await as(ids.rosa, (tx) => tx.query<{ id: string }>(`select id from public.events`));
    expect(r.rows.map((x) => x.id)).toEqual([eventA]);
  });

  it('el organizador de B no ve participantes ni regalos de A', async () => {
    const p = await as(ids.ownerB, (tx) => tx.query(`select 1 from public.participants where event_id = $1`, [eventA]));
    expect(p.rows).toHaveLength(0);
    await expectDenied(as(ids.ownerB, (tx) => tx.query(`select public.get_my_event_context($1)`, [eventA])));
  });

  it('nadie lee la tabla users ajena', async () => {
    const r = await as(ids.rosa, (tx) => tx.query(`select id from public.users`));
    expect(r.rows).toHaveLength(1);
  });
});

describe('RLS: listas de deseos', () => {
  it('un participante agrega sus regalos con enlaces', async () => {
    await as(ids.rosa, async (tx) => {
      const item = await tx.query<{ id: string }>(
        `insert into public.wishlist_items (event_id, participant_id, title, description, price_estimate)
         values ($1, $2, 'Polo', 'Talla M, azul', 45) returning id`,
        [eventA, participant.rosa],
      );
      await tx.query(`insert into public.wishlist_item_links (item_id, url) values ($1, 'https://www.falabella.com.pe/polo')`, [
        item.rows[0]!.id,
      ]);
    });
  });

  it('no puede agregar regalos a nombre de otra persona', async () => {
    await expectDenied(
      as(ids.rosa, (tx) =>
        tx.query(`insert into public.wishlist_items (event_id, participant_id, title) values ($1, $2, 'Hack')`, [eventA, participant.papa]),
      ),
    );
  });

  it('el tutor agrega regalos para su hijo, pero no para otros', async () => {
    await as(ids.papa, (tx) =>
      tx.query(`insert into public.wishlist_items (event_id, participant_id, title) values ($1, $2, 'Carrito')`, [eventA, participant.nino]),
    );
    await expectDenied(
      as(ids.papa, (tx) =>
        tx.query(`insert into public.wishlist_items (event_id, participant_id, title) values ($1, $2, 'X')`, [eventA, participant.rosa]),
      ),
    );
  });

  it('todos los del evento ven todas las listas; los de otro evento no', async () => {
    const mine = await as(ids.editor, (tx) => tx.query(`select title from public.wishlist_items order by title`));
    expect(mine.rows.map((r: any) => r.title)).toEqual(['Carrito', 'Polo']);
    const links = await as(ids.editor, (tx) => tx.query(`select url from public.wishlist_item_links`));
    expect(links.rows).toHaveLength(1);
    const other = await as(ids.ownerB, (tx) => tx.query(`select 1 from public.wishlist_items`));
    expect(other.rows).toHaveLength(0);
  });

  it('no puede editar ni borrar regalos ajenos (0 filas afectadas)', async () => {
    const upd = await as(ids.rosa, (tx) => tx.query(`update public.wishlist_items set title = 'X' where title = 'Carrito'`));
    expect(upd.affectedRows).toBe(0);
    const del = await as(ids.rosa, (tx) => tx.query(`delete from public.wishlist_items where title = 'Carrito'`));
    expect(del.affectedRows).toBe(0);
  });

  it('rechaza enlaces que no son http(s) y más de 5 enlaces', async () => {
    const item = await db.query<{ id: string }>(`select id from public.wishlist_items where title = 'Polo'`);
    const itemId = item.rows[0]!.id;
    await expect(
      as(ids.rosa, (tx) => tx.query(`insert into public.wishlist_item_links (item_id, url) values ($1, 'javascript:alert(1)')`, [itemId])),
    ).rejects.toThrow(/check constraint/);
    await as(ids.rosa, async (tx) => {
      for (let i = 0; i < 4; i++) {
        await tx.query(`insert into public.wishlist_item_links (item_id, url) values ($1, $2)`, [itemId, `https://tienda.pe/${i}`]);
      }
    });
    await expect(
      as(ids.rosa, (tx) => tx.query(`insert into public.wishlist_item_links (item_id, url) values ($1, 'https://tienda.pe/6')`, [itemId])),
    ).rejects.toThrow(/TOO_MANY_LINKS/);
  });
});

describe('RPC save_wishlist_item', () => {
  const save = (userId: string, args: unknown[]) =>
    as(userId, (tx) =>
      tx.query<{ id: string }>(
        `select public.save_wishlist_item($1, $2, $3, $4, $5, $6, $7::jsonb, $8) as id`,
        args,
      ),
    );

  it('crea y edita un regalo con sus enlaces en una transacción', async () => {
    const created = await save(ids.rosa, [eventA, participant.rosa, ' Colonia ', 'Floral', 120, 1, JSON.stringify([
      { url: 'https://a.pe/1', label: 'Saga' },
      { url: '  ' },
    ]), null]);
    const id = created.rows[0]!.id;
    let links = await db.query<{ url: string }>(`select url from public.wishlist_item_links where item_id = $1`, [id]);
    expect(links.rows.map((l) => l.url)).toEqual(['https://a.pe/1']);

    await save(ids.rosa, [eventA, participant.rosa, 'Colonia', null, null, 2, JSON.stringify([{ url: 'https://b.pe/2' }]), id]);
    links = await db.query<{ url: string }>(`select url from public.wishlist_item_links where item_id = $1`, [id]);
    expect(links.rows.map((l) => l.url)).toEqual(['https://b.pe/2']);
    const item = await db.query<{ title: string; description: string | null }>(`select title, description from public.wishlist_items where id = $1`, [id]);
    expect(item.rows[0]!).toEqual({ title: 'Colonia', description: null });
  });

  it('respeta RLS: no edita regalos ajenos y deshace todo si un enlace es inválido', async () => {
    const own = await save(ids.rosa, [eventA, participant.rosa, 'Billetera', null, null, 2, '[]', null]);
    await expect(save(ids.papa, [eventA, participant.rosa, 'X', null, null, 2, '[]', own.rows[0]!.id])).rejects.toThrow(/NOT_FOUND_OR_FORBIDDEN/);
    await expect(
      save(ids.rosa, [eventA, participant.rosa, 'Cartera', null, null, 2, JSON.stringify([{ url: 'ftp://x' }]), null]),
    ).rejects.toThrow(/check constraint/);
    const r = await db.query(`select 1 from public.wishlist_items where title = 'Cartera'`);
    expect(r.rows).toHaveLength(0);
  });
});

describe('checklist', () => {
  let general = '';
  let onlyLopez = '';

  it('organizador y editores crean tareas; los participantes no', async () => {
    const r = await as(ids.ownerA, (tx) =>
      tx.query<{ id: string }>(`insert into public.checklist_items (event_id, title) values ($1, 'Confirma tu asistencia') returning id`, [eventA]),
    );
    general = r.rows[0]!.id;
    await as(ids.editor, (tx) => tx.query(`insert into public.checklist_items (event_id, title) values ($1, 'Lleva un postre')`, [eventA]));
    await expectDenied(as(ids.rosa, (tx) => tx.query(`insert into public.checklist_items (event_id, title) values ($1, 'X')`, [eventA])));

    const fam = await as(ids.ownerA, (tx) =>
      tx.query<{ id: string }>(`insert into public.families (event_id, name, color_key) values ($1, 'LÓPEZ', 'blue') returning id`, [eventA]),
    );
    const item = await as(ids.ownerA, (tx) =>
      tx.query<{ id: string }>(
        `insert into public.checklist_items (event_id, title, scope, family_id) values ($1, 'Trae las luces', 'family', $2) returning id`,
        [eventA, fam.rows[0]!.id],
      ),
    );
    onlyLopez = item.rows[0]!.id;
  });

  it('cada quien marca sus tareas, las de sus hijos, y puede desmarcarlas', async () => {
    await as(ids.rosa, (tx) => tx.query(`insert into public.checklist_progress (item_id, participant_id) values ($1, $2)`, [general, participant.rosa]));
    await as(ids.papa, (tx) => tx.query(`insert into public.checklist_progress (item_id, participant_id) values ($1, $2)`, [general, participant.nino]));
    const del = await as(ids.rosa, (tx) => tx.query(`delete from public.checklist_progress where item_id = $1 and participant_id = $2`, [general, participant.rosa]));
    expect(del.affectedRows).toBe(1);
  });

  it('no puede marcar tareas de otras personas ni tareas que no le corresponden', async () => {
    await expectDenied(
      as(ids.rosa, (tx) => tx.query(`insert into public.checklist_progress (item_id, participant_id) values ($1, $2)`, [general, participant.papa])),
    );
    // Rosa no es de la familia LÓPEZ
    await expectDenied(
      as(ids.rosa, (tx) => tx.query(`insert into public.checklist_progress (item_id, participant_id) values ($1, $2)`, [onlyLopez, participant.rosa])),
    );
  });

  it('el organizador de otra Navidad no ve las tareas', async () => {
    const r = await as(ids.ownerB, (tx) => tx.query(`select 1 from public.checklist_items`));
    expect(r.rows).toHaveLength(0);
    await db.query(`delete from public.families where name = 'LÓPEZ' and event_id = $1`, [eventA]);
  });
});

describe('responsabilidades y aportes', () => {
  let pavo = '';
  let deco = '';
  let famPerez = '';
  const save = (userId: string, args: unknown[]) =>
    as(userId, (tx) =>
      tx.query<{ id: string }>(
        `select public.save_responsibility($1, $2, $3, $4, $5, $6, $7, $8, $9::uuid[], $10::uuid[], $11) as id`,
        args,
      ),
    );
  const setStatus = (userId: string, id: string, status: string) =>
    as(userId, (tx) => tx.query(`select public.set_responsibility_status($1, $2)`, [id, status]));

  beforeAll(async () => {
    const f = await db.query<{ id: string }>(`insert into public.families (event_id, name, color_key) values ($1, 'PÉREZ', 'gold') returning id`, [eventA]);
    famPerez = f.rows[0]!.id;
    await db.query(`update public.participants set family_id = $1 where id in ($2, $3)`, [famPerez, participant.papa, participant.nino]);
  });

  it('el editor crea un aporte con varias personas y una familia como responsables', async () => {
    const r = await save(ids.editor, [eventA, 'contribution', 'food', 'Pavo al horno', null, '2026-12-23', 'pending', null, `{${participant.rosa}}`, `{${famPerez}}`, null]);
    pavo = r.rows[0]!.id;
    const a = await db.query(`select 1 from public.responsibility_assignees where responsibility_id = $1`, [pavo]);
    expect(a.rows).toHaveLength(2);
    const d = await save(ids.ownerA, [eventA, 'task', 'decoration', 'Armar el árbol', null, null, 'pending', null, `{${participant.editor}}`, '{}', null]);
    deco = d.rows[0]!.id;
  });

  it('un participante no puede crear ni editar responsabilidades', async () => {
    await expectDenied(save(ids.rosa, [eventA, 'task', 'other', 'X', null, null, 'pending', null, '{}', '{}', null]));
    const upd = await as(ids.rosa, (tx) => tx.query(`update public.responsibilities set title = 'Hack' where id = $1`, [pavo]));
    expect(upd.affectedRows).toBe(0);
  });

  it('el responsable (directo o por su familia) marca el estado, y queda registrado quién lo hizo', async () => {
    await setStatus(ids.rosa, pavo, 'in_progress');
    await setStatus(ids.papa, pavo, 'done'); // por su familia PÉREZ
    const r = await db.query<{ status: string; completed_by_user_id: string | null }>(
      `select status, completed_by_user_id from public.responsibilities where id = $1`,
      [pavo],
    );
    expect(r.rows[0]).toEqual({ status: 'done', completed_by_user_id: ids.papa });
    await setStatus(ids.rosa, pavo, 'pending');
    const back = await db.query<{ completed_by_user_id: string | null }>(`select completed_by_user_id from public.responsibilities where id = $1`, [pavo]);
    expect(back.rows[0]!.completed_by_user_id).toBeNull();
  });

  it('quien no es responsable no puede cambiar el estado', async () => {
    await expect(setStatus(ids.rosa, deco, 'done')).rejects.toThrow(/FORBIDDEN/);
    await expect(setStatus(ids.ownerB, deco, 'done')).rejects.toThrow(/NOT_FOUND/);
    await expect(setStatus(ids.editor, deco, 'terminado')).rejects.toThrow(/STATUS_INVALID/);
  });

  it('todos los del evento ven todas las responsabilidades; los de otra Navidad no', async () => {
    const mine = await as(ids.rosa, (tx) => tx.query(`select 1 from public.responsibilities`));
    expect(mine.rows).toHaveLength(2);
    const other = await as(ids.ownerB, (tx) => tx.query(`select 1 from public.responsibilities`));
    expect(other.rows).toHaveLength(0);
  });

  it('al editar se reemplazan los responsables', async () => {
    await save(ids.editor, [eventA, 'contribution', 'food', 'Pavo', null, null, 'pending', 'Dos pavos', `{${participant.editor}}`, '{}', pavo]);
    const a = await db.query<{ participant_id: string }>(`select participant_id from public.responsibility_assignees where responsibility_id = $1`, [pavo]);
    expect(a.rows.map((x) => x.participant_id)).toEqual([participant.editor]);
    await db.query(`update public.participants set family_id = null where id in ($1, $2)`, [participant.papa, participant.nino]);
    await db.query(`delete from public.families where id = $1`, [famPerez]);
  });
});

describe('juegos y votación', () => {
  const g = {} as Record<'charadas' | 'mimica' | 'sillas' | 'bingo' | 'merged', string>;
  const addGame = (userId: string, proposer: string | undefined, name: string) =>
    as(userId, (tx) =>
      tx.query<{ id: string }>(
        `insert into public.games (event_id, proposed_by_participant_id, name) values ($1, $2, $3) returning id`,
        [eventA, proposer, name],
      ),
    ).then((r) => r.rows[0]!.id);
  const vote = (userId: string, game: string, participantId: string | undefined) =>
    as(userId, (tx) => tx.query(`select public.cast_game_vote($1, $2)`, [game, participantId]));
  const poll = (userId: string, status: string, max: number | null = null) =>
    as(userId, (tx) => tx.query(`select public.set_game_poll($1, $2, $3)`, [eventA, status, max]));
  const votesOf = async (game: string) =>
    (await db.query<{ n: number }>(`select count(*)::int as n from public.game_votes where game_id = $1`, [game])).rows[0]!.n;

  it('cualquiera propone juegos (a su nombre o al de su hijo), sin aprobación', async () => {
    g.charadas = await addGame(ids.rosa, participant.rosa, 'Charadas navideñas');
    g.mimica = await addGame(ids.papa, participant.papa, 'Mímica de películas');
    g.sillas = await addGame(ids.papa, participant.nino, 'Las sillas musicales');
    g.bingo = await addGame(ids.editor, participant.editor, 'Bingo');
    await expectDenied(addGame(ids.rosa, participant.papa, 'A nombre de otro'));
  });

  it('no permite dos juegos con el mismo nombre (sin importar tildes, mayúsculas ni signos)', async () => {
    await expect(addGame(ids.editor, participant.editor, '  CHARADAS   Navidenas! ')).rejects.toThrow(/games_unique_name/);
  });

  it('quien propuso edita o quita su idea; los demás participantes no', async () => {
    await as(ids.rosa, (tx) => tx.query(`update public.games set description = 'Adivina sin hablar' where id = $1`, [g.charadas]));
    const other = await as(ids.rosa, (tx) => tx.query(`update public.games set description = 'X' where id = $1`, [g.mimica]));
    expect(other.affectedRows).toBe(0);
    await expectDenied(as(ids.rosa, (tx) => tx.query(`update public.games set status = 'played' where id = $1`, [g.charadas])));
  });

  it('solo se vota con la votación abierta, y la abren organizador/editores', async () => {
    await expect(vote(ids.rosa, g.charadas, participant.rosa)).rejects.toThrow(/POLL_CLOSED/);
    await expect(poll(ids.rosa, 'open')).rejects.toThrow(/FORBIDDEN/);
    await poll(ids.editor, 'open', 2);
  });

  it('respeta el máximo de votos por persona y un voto por juego; el tutor vota por su hijo', async () => {
    await vote(ids.rosa, g.charadas, participant.rosa);
    await vote(ids.rosa, g.charadas, participant.rosa); // repetido: no cuenta doble
    await vote(ids.rosa, g.mimica, participant.rosa);
    await expect(vote(ids.rosa, g.bingo, participant.rosa)).rejects.toThrow(/VOTE_LIMIT_REACHED/);
    await expect(vote(ids.rosa, g.bingo, participant.papa)).rejects.toThrow(/FORBIDDEN/);
    await vote(ids.papa, g.mimica, participant.papa);
    await vote(ids.papa, g.charadas, participant.nino);
    expect(await votesOf(g.charadas)).toBe(2);
    expect(await votesOf(g.mimica)).toBe(2);
    await as(ids.rosa, (tx) => tx.query(`select public.remove_game_vote($1, $2)`, [g.mimica, participant.rosa]));
    expect(await votesOf(g.mimica)).toBe(1);
    await vote(ids.rosa, g.mimica, participant.rosa);
  });

  it('nadie puede insertar votos directamente', async () => {
    const p = await db.query<{ id: string }>(`select id from public.game_polls where event_id = $1`, [eventA]);
    await expectDenied(
      as(ids.rosa, (tx) =>
        tx.query(`insert into public.game_votes (poll_id, game_id, participant_id) values ($1, $2, $3)`, [p.rows[0]!.id, g.bingo, participant.rosa]),
      ),
    );
  });

  it('unir juegos en uno nuevo: los votos pasan, contando una vez a quien votó por ambos', async () => {
    await expect(
      as(ids.rosa, (tx) => tx.query(`select public.merge_games($1, $2::uuid[], null, 'X')`, [eventA, `{${g.charadas},${g.mimica}}`])),
    ).rejects.toThrow(/FORBIDDEN/);

    // Rosa votó por ambos; Juan por mímica; el niño por charadas → 3 personas distintas
    const r = await as(ids.editor, (tx) =>
      tx.query<{ id: string }>(
        `select public.merge_games($1, $2::uuid[], null, 'Charadas navideñas', 'competition', 'Charadas y mímica juntas') as id`,
        [eventA, `{${g.charadas},${g.mimica}}`],
      ),
    );
    const merged = r.rows[0]!.id;
    expect(await votesOf(merged)).toBe(3);
    expect(await votesOf(g.charadas)).toBe(0);
    const old = await db.query<{ status: string; merged_into_game_id: string }>(
      `select status, merged_into_game_id from public.games where id = any($1::uuid[]) order by name`,
      [`{${g.charadas},${g.mimica}}`],
    );
    expect(old.rows.every((x) => x.status === 'merged' && x.merged_into_game_id === merged)).toBe(true);
    // Rosa recuperó un voto: ahora puede votar por bingo
    await vote(ids.rosa, g.bingo, participant.rosa);
    g.merged = merged;
  });

  it('unir conservando uno existente; no se pueden votar juegos unidos', async () => {
    const r = await as(ids.ownerA, (tx) =>
      tx.query<{ id: string }>(`select public.merge_games($1, $2::uuid[], $3) as id`, [eventA, `{${g.sillas},${g.bingo}}`, g.bingo]),
    );
    expect(r.rows[0]!.id).toBe(g.bingo);
    await expect(vote(ids.papa, g.sillas, participant.papa)).rejects.toThrow(/GAME_NOT_VOTABLE/);
    await expect(
      as(ids.editor, (tx) => tx.query(`select public.merge_games($1, $2::uuid[])`, [eventA, `{${g.bingo}}`])),
    ).rejects.toThrow(/MERGE_NEEDS_TWO_GAMES/);
  });

  it('la otra Navidad no ve juegos ni votos', async () => {
    const r = await as(ids.ownerB, (tx) => tx.query(`select 1 from public.games union all select 1 from public.game_votes`));
    expect(r.rows).toHaveLength(0);
  });
});

describe('amigo secreto (opcional y privado)', () => {
  const note = (userId: string, giver: string | undefined, receiver: string | undefined) =>
    as(userId, (tx) =>
      tx.query(`insert into public.secret_friend_notes (event_id, giver_participant_id, receiver_participant_id) values ($1, $2, $3)`, [
        eventA,
        giver,
        receiver,
      ]),
    );

  it('cada quien anota el suyo; el tutor también por su hijo', async () => {
    await note(ids.rosa, participant.rosa, participant.papa);
    await note(ids.papa, participant.nino, participant.rosa);
  });

  it('nadie más lo ve: ni el organizador, ni el editor, ni otros participantes', async () => {
    for (const user of [ids.ownerA, ids.editor, ids.papa]) {
      const r = await as(user, (tx) => tx.query(`select 1 from public.secret_friend_notes where giver_participant_id = $1`, [participant.rosa]));
      expect(r.rows).toHaveLength(0);
    }
    const own = await as(ids.rosa, (tx) => tx.query<{ receiver_participant_id: string }>(`select receiver_participant_id from public.secret_friend_notes`));
    expect(own.rows.map((x) => x.receiver_participant_id)).toEqual([participant.papa]);
  });

  it('no puede anotar por otra persona, ni a sí mismo, ni a alguien de otra Navidad', async () => {
    await expectDenied(note(ids.rosa, participant.editor, participant.papa));
    await expect(note(ids.editor, participant.editor, participant.editor)).rejects.toThrow(/check constraint/);
    const otherEvent = await db.query<{ id: string }>(`select id from public.participants where event_id = $1 limit 1`, [eventB]);
    await expect(note(ids.editor, participant.editor, otherEvent.rows[0]!.id)).rejects.toThrow(/foreign key/);
  });

  it('dos personas pueden anotar a la misma (la app no revela quién ya fue elegido)', async () => {
    await note(ids.editor, participant.editor, participant.papa);
  });

  it('puede cambiarlo o quitarlo; el organizador no puede borrarlo', async () => {
    const upd = await as(ids.rosa, (tx) =>
      tx.query(`update public.secret_friend_notes set receiver_participant_id = $1 where giver_participant_id = $2`, [participant.editor, participant.rosa]),
    );
    expect(upd.affectedRows).toBe(1);
    const del = await as(ids.ownerA, (tx) => tx.query(`delete from public.secret_friend_notes where giver_participant_id = $1`, [participant.rosa]));
    expect(del.affectedRows).toBe(0);
    const own = await as(ids.rosa, (tx) => tx.query(`delete from public.secret_friend_notes where giver_participant_id = $1`, [participant.rosa]));
    expect(own.affectedRows).toBe(1);
  });
});

describe('RLS: gestión del evento', () => {
  it('solo organizador/administradores gestionan familias (no editores ni participantes)', async () => {
    await as(ids.ownerA, (tx) => tx.query(`insert into public.families (event_id, name, color_key) values ($1, ' garcía ', 'red')`, [eventA]));
    const f = await db.query<{ name: string }>(`select name from public.families where event_id = $1`, [eventA]);
    expect(f.rows[0]!.name).toBe('GARCÍA');
    await expectDenied(as(ids.editor, (tx) => tx.query(`insert into public.families (event_id, name) values ($1, 'LÓPEZ')`, [eventA])));
    await expectDenied(as(ids.rosa, (tx) => tx.query(`insert into public.families (event_id, name) values ($1, 'LÓPEZ')`, [eventA])));
  });

  it('nadie puede asignarse un user_id desde el navegador', async () => {
    await expectDenied(as(ids.ownerA, (tx) => tx.query(`update public.participants set user_id = $1 where id = $2`, [ids.ownerA, participant.rosa])));
  });

  it('un participante no puede cambiar su rol', async () => {
    await expectDenied(as(ids.rosa, (tx) => tx.query(`update public.event_members set role = 'owner' where user_id = $1`, [ids.rosa])));
  });

  it('list_event_members solo para organizador/administradores', async () => {
    const r = await as(ids.ownerA, (tx) => tx.query<{ username: string | null }>(`select * from public.list_event_members($1)`, [eventA]));
    expect(r.rows.map((x) => x.username)).toContain('rosa');
    await expectDenied(as(ids.rosa, (tx) => tx.query(`select * from public.list_event_members($1)`, [eventA])));
    await expectDenied(as(ids.editor, (tx) => tx.query(`select * from public.list_event_members($1)`, [eventA])));
  });

  it('get_my_event_context devuelve rol, perfil y personas a cargo', async () => {
    const r = await as(ids.papa, (tx) => tx.query<{ ctx: any }>(`select public.get_my_event_context($1) as ctx`, [eventA]));
    expect(r.rows[0]!.ctx.role).toBe('participant');
    expect(r.rows[0]!.ctx.participant.full_name).toBe('JUAN PÉREZ');
    expect(r.rows[0]!.ctx.wards.map((w: any) => w.full_name)).toEqual(['PEDRITO PÉREZ']);
  });

  it('borrar una familia deja a sus integrantes sin familia', async () => {
    const fam = await db.query<{ id: string }>(`select id from public.families where event_id = $1`, [eventA]);
    await db.query(`update public.participants set family_id = $1 where id = $2`, [fam.rows[0]!.id, participant.rosa]);
    await as(ids.ownerA, (tx) => tx.query(`delete from public.families where id = $1`, [fam.rows[0]!.id]));
    const p = await db.query<{ family_id: string | null; event_id: string }>(
      `select family_id, event_id from public.participants where id = $1`,
      [participant.rosa],
    );
    expect(p.rows[0]!).toEqual({ family_id: null, event_id: eventA });
  });

  it('anon no puede leer nada', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.exec('set local role anon');
        await tx.query('select * from public.events');
      }),
    ).rejects.toThrow(/permission denied/);
  });
});
