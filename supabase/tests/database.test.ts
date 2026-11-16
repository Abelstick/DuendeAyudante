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

  it('guarda marcas (limpias, sin repetir) y un rango de precios válido', async () => {
    const saveFull = (args: unknown[]) =>
      as(ids.rosa, (tx) =>
        tx.query<{ id: string }>(
          `select public.save_wishlist_item($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::text[]) as id`,
          args,
        ),
      );
    const created = await saveFull([eventA, participant.rosa, 'Zapatillas', null, 150, 1, '[]', null, 250, [' Nike ', 'NIKE', '', 'Adidas']]);
    const id = created.rows[0]!.id;
    const item = await db.query<{ price_estimate: string; price_max: string; brands: string[] }>(
      `select price_estimate, price_max, brands from public.wishlist_items where id = $1`,
      [id],
    );
    expect(item.rows[0]!).toEqual({ price_estimate: '150.00', price_max: '250.00', brands: ['Nike', 'Adidas'] });

    await expect(saveFull([eventA, participant.rosa, 'Zapatillas', null, 300, 1, '[]', id, 100, []])).rejects.toThrow(/PRICE_RANGE_INVALID/);
    const nine = Array.from({ length: 9 }, (_, i) => `Marca ${i}`);
    await expect(saveFull([eventA, participant.rosa, 'Zapatillas', null, null, 1, '[]', id, null, nine])).rejects.toThrow(/TOO_MANY_BRANDS/);
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

describe('cronograma y anuncios', () => {
  it('editores y organizador gestionan el cronograma; los participantes solo lo ven', async () => {
    await as(ids.editor, (tx) =>
      tx.query(`insert into public.schedule_items (event_id, title, starts_at, ends_at) values ($1, 'Cena navideña', '2026-12-24 20:00-05', '2026-12-24 21:00-05')`, [eventA]),
    );
    await expectDenied(
      as(ids.rosa, (tx) => tx.query(`insert into public.schedule_items (event_id, title, starts_at) values ($1, 'X', now())`, [eventA])),
    );
    await expect(
      as(ids.editor, (tx) =>
        tx.query(`insert into public.schedule_items (event_id, title, starts_at, ends_at) values ($1, 'Al revés', '2026-12-24 21:00-05', '2026-12-24 20:00-05')`, [eventA]),
      ),
    ).rejects.toThrow(/check constraint/);
    const seen = await as(ids.rosa, (tx) => tx.query(`select title from public.schedule_items`));
    expect(seen.rows).toHaveLength(1);
    const other = await as(ids.ownerB, (tx) => tx.query(`select 1 from public.schedule_items`));
    expect(other.rows).toHaveLength(0);
  });

  it('los anuncios se firman solos con el nombre del autor (no se puede falsificar)', async () => {
    await as(ids.editor, (tx) =>
      tx.query(`insert into public.announcements (event_id, title, body, priority) values ($1, 'Cambio de hora', 'Empezamos a las 6', 'important')`, [eventA]),
    );
    const r = await db.query<{ author_name: string; author_user_id: string }>(`select author_name, author_user_id from public.announcements where event_id = $1`, [eventA]);
    expect(r.rows[0]).toEqual({ author_name: 'LUCÍA DÍAZ', author_user_id: ids.editor });
    await expectDenied(
      as(ids.rosa, (tx) => tx.query(`insert into public.announcements (event_id, title, body) values ($1, 'X', 'Y')`, [eventA])),
    );
    await expectDenied(
      as(ids.editor, (tx) => tx.query(`update public.announcements set author_name = 'OTRO' where event_id = $1`, [eventA])),
    );
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

  it('enlace de familia: solo quien administra lo crea y lo ve; el enlace no cambia al cambiar la palabra', async () => {
    const fam = await db.query<{ id: string }>(
      `insert into public.families (event_id, name) values ($1, 'enlace') returning id`,
      [eventA],
    );
    const familyId = fam.rows[0]!.id;

    // Un participante y un editor no pueden crearlo
    await expectDenied(as(ids.rosa, (tx) => tx.query(`select * from public.set_family_access_word($1, 'paneton')`, [familyId])));
    await expectDenied(as(ids.editor, (tx) => tx.query(`select * from public.set_family_access_word($1, 'paneton')`, [familyId])));
    // Tampoco el organizador de otra Navidad
    await expectDenied(as(ids.ownerB, (tx) => tx.query(`select * from public.set_family_access_word($1, 'paneton')`, [familyId])));

    const first = await as(ids.ownerA, (tx) =>
      tx.query<{ link_token: string; secret_word: string }>(`select * from public.set_family_access_word($1, '  Panetón 25 ')`, [familyId]),
    );
    expect(first.rows[0]!.secret_word).toBe('PANETON25');
    expect(first.rows[0]!.link_token).toMatch(/^[a-f0-9]{32}$/);

    const second = await as(ids.ownerA, (tx) =>
      tx.query<{ link_token: string; secret_word: string }>(`select * from public.set_family_access_word($1, 'estrella')`, [familyId]),
    );
    expect(second.rows[0]!).toEqual({ link_token: first.rows[0]!.link_token, secret_word: 'ESTRELLA' });

    // Palabras inválidas
    await expect(as(ids.ownerA, (tx) => tx.query(`select * from public.set_family_access_word($1, 'ab')`, [familyId]))).rejects.toThrow(/SECRET_WORD_INVALID/);
    await expect(as(ids.ownerA, (tx) => tx.query(`select * from public.set_family_access_word($1, 'hola-mundo')`, [familyId]))).rejects.toThrow(
      /SECRET_WORD_INVALID/,
    );

    // Lectura: el organizador ve la palabra; participantes y editores no ven nada
    const seen = await as(ids.ownerA, (tx) => tx.query<{ secret_word: string }>(`select secret_word from public.family_access where family_id = $1`, [familyId]));
    expect(seen.rows.map((r) => r.secret_word)).toEqual(['ESTRELLA']);
    for (const user of [ids.rosa, ids.editor, ids.ownerB]) {
      const hidden = await as(user, (tx) => tx.query(`select secret_word from public.family_access where family_id = $1`, [familyId]));
      expect(hidden.rows).toEqual([]);
    }
    // Nadie escribe la tabla directamente, ni lee los contadores de intentos
    await expectDenied(as(ids.ownerA, (tx) => tx.query(`update public.family_access set secret_word = 'OTRA' where family_id = $1`, [familyId])));
    await expectDenied(as(ids.ownerA, (tx) => tx.query(`select failed_attempts from public.family_access`)));
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

describe('fotos de regalos en Google Drive', () => {
  let familyId = '';
  let itemId = '';
  const fileId = (n: number) => `driveFile_${n}_abcdefghij`;

  beforeAll(async () => {
    const fam = await db.query<{ id: string }>(`insert into public.families (event_id, name) values ($1, 'fotos') returning id`, [eventA]);
    familyId = fam.rows[0]!.id;
    // Lo que guarda la Edge Function google-drive al conectar (service role)
    await db.query(
      `insert into public.family_drives (family_id, event_id, google_email, refresh_token, folder_id) values ($1, $2, 'tia@gmail.com', 'secreto', 'carpeta')`,
      [familyId, eventA],
    );
    const item = await db.query<{ id: string }>(
      `insert into public.wishlist_items (event_id, participant_id, title) values ($1, $2, 'Polo') returning id`,
      [eventA, participant.nino],
    );
    itemId = item.rows[0]!.id;
  });

  it('nadie lee el token de Google desde el navegador, ni el organizador', async () => {
    for (const user of [ids.ownerA, ids.rosa, ids.editor]) {
      await expectDenied(as(user, (tx) => tx.query(`select refresh_token from public.family_drives`)));
      await expectDenied(as(user, (tx) => tx.query(`select * from public.drive_file_trash`)));
    }
  });

  it('todos saben qué familias tienen Drive; el correo solo lo ve quien administra; otra Navidad no ve nada', async () => {
    const forOwner = await as(ids.ownerA, (tx) =>
      tx.query<{ family_id: string; google_email: string | null }>(`select family_id, google_email from public.list_family_drives($1)`, [eventA]),
    );
    expect(forOwner.rows).toEqual([{ family_id: familyId, google_email: 'tia@gmail.com' }]);
    const forRosa = await as(ids.rosa, (tx) => tx.query<{ google_email: string | null }>(`select google_email from public.list_family_drives($1)`, [eventA]));
    expect(forRosa.rows).toEqual([{ google_email: null }]);
    const forOther = await as(ids.ownerB, (tx) => tx.query(`select * from public.list_family_drives($1)`, [eventA]));
    expect(forOther.rows).toEqual([]);
  });

  it('can_edit_wishlist_item: la persona, su tutor y quien administra; nadie más', async () => {
    const check = (user: string) =>
      as(user, (tx) => tx.query<{ ok: boolean }>(`select public.can_edit_wishlist_item($1) as ok`, [itemId])).then((r) => r.rows[0]!.ok);
    expect(await check(ids.papa)).toBe(true); // tutor de Pedrito
    expect(await check(ids.ownerA)).toBe(true);
    expect(await check(ids.rosa)).toBe(false);
    expect(await check(ids.editor)).toBe(false);
    expect(await check(ids.ownerB)).toBe(false);
  });

  it('los miembros ven las fotos pero no las escriben; máximo 6 por regalo', async () => {
    for (let n = 1; n <= 6; n++) {
      await db.query(`insert into public.wishlist_photos (item_id, event_id, family_id, drive_file_id, sort_order) values ($1, $2, $3, $4, $5)`, [
        itemId,
        eventA,
        familyId,
        fileId(n),
        n,
      ]);
    }
    await expect(
      db.query(`insert into public.wishlist_photos (item_id, event_id, family_id, drive_file_id) values ($1, $2, $3, $4)`, [itemId, eventA, familyId, fileId(7)]),
    ).rejects.toThrow(/TOO_MANY_PHOTOS/);

    const seen = await as(ids.rosa, (tx) => tx.query(`select id from public.wishlist_photos where item_id = $1`, [itemId]));
    expect(seen.rows).toHaveLength(6);
    const other = await as(ids.ownerB, (tx) => tx.query(`select id from public.wishlist_photos where item_id = $1`, [itemId]));
    expect(other.rows).toEqual([]);

    await expectDenied(
      as(ids.papa, (tx) =>
        tx.query(`insert into public.wishlist_photos (item_id, event_id, family_id, drive_file_id) values ($1, $2, $3, $4)`, [itemId, eventA, familyId, fileId(9)]),
      ),
    );
    await expectDenied(as(ids.ownerA, (tx) => tx.query(`delete from public.wishlist_photos where item_id = $1`, [itemId])));
  });

  it('al borrar el regalo, sus archivos quedan en la papelera para borrarlos de Drive', async () => {
    await as(ids.papa, (tx) => tx.query(`delete from public.wishlist_items where id = $1`, [itemId]));
    const trash = await db.query<{ drive_file_id: string }>(`select drive_file_id from public.drive_file_trash where family_id = $1 order by drive_file_id`, [familyId]);
    expect(trash.rows.map((r) => r.drive_file_id)).toEqual([1, 2, 3, 4, 5, 6].map(fileId));
  });
});

describe('borrar mi cuenta', () => {
  const ownerC = '00000000-0000-0000-0000-0000000000c1';
  const adminC = '00000000-0000-0000-0000-0000000000c2';
  const memberC = '00000000-0000-0000-0000-0000000000c3';
  let eventC = '';
  let eventSolo = '';
  let memberParticipant = '';

  beforeAll(async () => {
    await db.query(`insert into auth.users (id, email) values ($1, 'carla@example.com')`, [ownerC]);
    eventC = await as(ownerC, async (tx) => {
      const r = await tx.query<{ id: string }>(`select public.create_event('Navidad Ruiz', 'RUIZ26', '2026-12-24 20:00-05', 'Carla', 'Ruiz') as id`);
      return r.rows[0]!.id;
    });
    eventSolo = await as(ownerC, async (tx) => {
      const r = await tx.query<{ id: string }>(`select public.create_event('Prueba sola', 'SOLA26', '2026-12-25 20:00-05', 'Carla', 'Ruiz') as id`);
      return r.rows[0]!.id;
    });
    await createMember({ userId: adminC, username: 'mario', eventId: eventC, first: 'Mario', paternal: 'Ruiz', role: 'admin' });
    memberParticipant = await createMember({ userId: memberC, username: 'tere', eventId: eventC, first: 'Tere', paternal: 'Ruiz' });
    await db.query(`insert into public.wishlist_items (event_id, participant_id, title) values ($1, $2, 'Bufanda')`, [eventC, memberParticipant]);
  });

  const deleteAccount = (user: string, confirm: string, successors: Record<string, string> = {}) =>
    as(user, (tx) => tx.query(`select public.delete_my_account($1, $2::jsonb)`, [confirm, JSON.stringify(successors)]));

  it('hay que escribir BORRAR', async () => {
    await expect(deleteAccount(memberC, 'si')).rejects.toThrow(/DELETE_CONFIRMATION_REQUIRED/);
  });

  it('un familiar pierde el acceso, pero su perfil y sus regalos se quedan', async () => {
    await deleteAccount(memberC, ' borrar ');
    expect((await db.query(`select 1 from auth.users where id = $1`, [memberC])).rows).toEqual([]);
    expect((await db.query(`select 1 from public.event_members where user_id = $1`, [memberC])).rows).toEqual([]);
    const p = await db.query<{ user_id: string | null; status: string }>(`select user_id, status from public.participants where id = $1`, [memberParticipant]);
    expect(p.rows[0]).toEqual({ user_id: null, status: 'active' });
    expect((await db.query(`select 1 from public.wishlist_items where participant_id = $1`, [memberParticipant])).rows).toHaveLength(1);
  });

  it('el organizador ve a quién puede pasar cada celebración', async () => {
    const r = await as(ownerC, (tx) =>
      tx.query<{ event_id: string; successors: { userId: string; name: string }[] }>(`select event_id, successors from public.my_owned_events()`),
    );
    expect(r.rows).toEqual([
      { event_id: eventC, successors: [{ userId: adminC, name: 'MARIO RUIZ' }] },
      { event_id: eventSolo, successors: [] },
    ]);
  });

  it('el organizador no puede irse sin resolver cada celebración, ni pasarla a quien no es administrador', async () => {
    await expect(deleteAccount(ownerC, 'BORRAR', { [eventC]: adminC })).rejects.toThrow(/OWNER_NEEDS_SUCCESSOR/);
    await expect(deleteAccount(ownerC, 'BORRAR', { [eventC]: ids.rosa, [eventSolo]: 'DELETE' })).rejects.toThrow(/SUCCESSOR_INVALID/);
    await expect(deleteAccount(ownerC, 'BORRAR', { [eventC]: 'no-es-uuid', [eventSolo]: 'DELETE' })).rejects.toThrow(/SUCCESSOR_INVALID/);
    // Nada cambió (todo o nada)
    expect((await db.query(`select 1 from public.events where id = $1`, [eventSolo])).rows).toHaveLength(1);
    expect((await db.query(`select 1 from auth.users where id = $1`, [ownerC])).rows).toHaveLength(1);
  });

  it('pasa la celebración al administrador elegido, borra la otra y luego la cuenta', async () => {
    await deleteAccount(ownerC, 'BORRAR', { [eventC]: adminC, [eventSolo]: 'DELETE' });
    const ev = await db.query<{ owner_user_id: string }>(`select owner_user_id from public.events where id = $1`, [eventC]);
    expect(ev.rows[0]!.owner_user_id).toBe(adminC);
    const role = await db.query<{ role: string }>(`select role from public.event_members where event_id = $1 and user_id = $2`, [eventC, adminC]);
    expect(role.rows[0]!.role).toBe('owner');
    expect((await db.query(`select 1 from public.events where id = $1`, [eventSolo])).rows).toEqual([]);
    expect((await db.query(`select 1 from auth.users where id = $1`, [ownerC])).rows).toEqual([]);
    // El nuevo organizador ya administra
    const ctx = await as(adminC, (tx) => tx.query<{ ok: boolean }>(`select app.is_manager($1) as ok`, [eventC]));
    expect(ctx.rows[0]!.ok).toBe(true);
  });
});

describe('Google Drive general de la celebración', () => {
  it('es secreto; todos saben si existe y solo quien administra ve el correo', async () => {
    await db.query(
      `insert into public.event_drives (event_id, google_email, refresh_token, folder_id) values ($1, 'abuela@gmail.com', 'secreto', 'carpeta')`,
      [eventA],
    );
    for (const user of [ids.ownerA, ids.rosa]) {
      await expectDenied(as(user, (tx) => tx.query(`select refresh_token from public.event_drives`)));
    }
    const owner = await as(ids.ownerA, (tx) => tx.query<{ google_email: string | null }>(`select google_email from public.get_event_drive($1)`, [eventA]));
    expect(owner.rows).toEqual([{ google_email: 'abuela@gmail.com' }]);
    const rosa = await as(ids.rosa, (tx) => tx.query<{ google_email: string | null }>(`select google_email from public.get_event_drive($1)`, [eventA]));
    expect(rosa.rows).toEqual([{ google_email: null }]);
    const other = await as(ids.ownerB, (tx) => tx.query(`select * from public.get_event_drive($1)`, [eventA]));
    expect(other.rows).toEqual([]);
  });

  it('al borrar una foto del Drive general, va a la papelera de la celebración', async () => {
    const item = await db.query<{ id: string }>(`insert into public.wishlist_items (event_id, participant_id, title) values ($1, $2, 'Taza') returning id`, [
      eventA,
      participant.rosa,
    ]);
    const photo = await db.query<{ id: string }>(
      `insert into public.wishlist_photos (item_id, event_id, drive_file_id, in_event_drive) values ($1, $2, 'generalFile_abcdefghij', true) returning id`,
      [item.rows[0]!.id, eventA],
    );
    await db.query(`delete from public.wishlist_photos where id = $1`, [photo.rows[0]!.id]);
    const trash = await db.query<{ event_id: string; family_id: string | null }>(
      `select event_id, family_id from public.drive_file_trash where drive_file_id = 'generalFile_abcdefghij'`,
    );
    expect(trash.rows).toEqual([{ event_id: eventA, family_id: null }]);
  });
});

describe('dirección de la celebración', () => {
  it('quien administra la cambia; los participantes no', async () => {
    const upd = await as(ids.ownerA, (tx) => tx.query(`update public.events set address = 'Av. Larco 123, Miraflores' where id = $1`, [eventA]));
    expect(upd.affectedRows).toBe(1);
    const hack = await as(ids.rosa, (tx) => tx.query(`update public.events set address = 'X' where id = $1`, [eventA]));
    expect(hack.affectedRows).toBe(0);
    await expect(
      as(ids.ownerA, (tx) => tx.query(`update public.events set address = repeat('a', 301) where id = $1`, [eventA])),
    ).rejects.toThrow(/check constraint/);
  });

  it('también guarda de quién es la casa', async () => {
    const upd = await as(ids.ownerA, (tx) => tx.query(`update public.events set address_host = 'la abuela Rosa' where id = $1`, [eventA]));
    expect(upd.affectedRows).toBe(1);
    const hack = await as(ids.rosa, (tx) => tx.query(`update public.events set address_host = 'X' where id = $1`, [eventA]));
    expect(hack.affectedRows).toBe(0);
    await expect(
      as(ids.ownerA, (tx) => tx.query(`update public.events set address_host = repeat('a', 81) where id = $1`, [eventA])),
    ).rejects.toThrow(/check constraint/);
  });
});

describe('preguntas anónimas sobre regalos', () => {
  type Row = { id: string; question: string; answer: string | null; is_mine: boolean; answer_unseen: boolean };
  const list = (userId: string) => as(userId, (tx) => tx.query<Row>(`select * from public.list_wishlist_questions($1)`, [eventA]));
  let item = '';
  let question = '';

  it('se pregunta por el regalo de otra persona, no por los propios', async () => {
    item = (await as(ids.rosa, (tx) => tx.query<{ id: string }>(`select public.save_wishlist_item($1, $2, 'Zapatillas') as id`, [eventA, participant.rosa]))).rows[0]!.id;
    question = (await as(ids.papa, (tx) => tx.query<{ id: string }>(`select public.ask_wishlist_question($1, '  ¿Qué talla?  ') as id`, [item]))).rows[0]!.id;

    await expect(as(ids.rosa, (tx) => tx.query(`select public.ask_wishlist_question($1, '¿Y el color?')`, [item]))).rejects.toThrow(/QUESTION_OWN_ITEM/);
    await expect(as(ids.papa, (tx) => tx.query(`select public.ask_wishlist_question($1, '   ')`, [item]))).rejects.toThrow(/QUESTION_INVALID/);
    await expectDenied(as(ids.ownerB, (tx) => tx.query(`select public.ask_wishlist_question($1, '¿Qué talla?')`, [item])));
    await expectDenied(as(ids.ownerB, (tx) => tx.query(`select * from public.list_wishlist_questions($1)`, [eventA])));
  });

  it('nadie puede saber quién preguntó, ni el organizador', async () => {
    await expectDenied(as(ids.ownerA, (tx) => tx.query(`select * from public.wishlist_questions`)));
    for (const viewer of [ids.rosa, ids.ownerA, ids.editor]) {
      const rows = (await list(viewer)).rows;
      expect(rows).toHaveLength(1);
      expect(Object.keys(rows[0]!).sort()).toEqual(['answer', 'answer_unseen', 'answered_at', 'created_at', 'id', 'is_mine', 'item_id', 'question']);
      expect(rows[0]).toMatchObject({ question: '¿Qué talla?', answer: null, is_mine: false });
    }
    expect((await list(ids.papa)).rows[0]).toMatchObject({ is_mine: true, answer_unseen: false });
  });

  it('responde la persona del regalo; quien preguntó recibe el aviso una sola vez', async () => {
    await expectDenied(as(ids.editor, (tx) => tx.query(`select public.answer_wishlist_question($1, '40')`, [question])));
    await as(ids.rosa, (tx) => tx.query(`select public.answer_wishlist_question($1, ' Talla 38 ')`, [question]));

    expect((await list(ids.editor)).rows[0]).toMatchObject({ answer: 'Talla 38', is_mine: false, answer_unseen: false });
    expect((await list(ids.papa)).rows[0]).toMatchObject({ answer: 'Talla 38', is_mine: true, answer_unseen: true });

    // Que otra persona abra el regalo no apaga el aviso de quien preguntó
    await as(ids.editor, (tx) => tx.query(`select public.mark_wishlist_answers_seen($1)`, [item]));
    expect((await list(ids.papa)).rows[0]!.answer_unseen).toBe(true);
    await as(ids.papa, (tx) => tx.query(`select public.mark_wishlist_answers_seen($1)`, [item]));
    expect((await list(ids.papa)).rows[0]!.answer_unseen).toBe(false);
  });

  it('quien preguntó la quita solo si no tiene respuesta; la persona del regalo, siempre', async () => {
    await expectDenied(as(ids.papa, (tx) => tx.query(`select public.delete_wishlist_question($1)`, [question])));
    const other = (await as(ids.papa, (tx) => tx.query<{ id: string }>(`select public.ask_wishlist_question($1, '¿De qué color?') as id`, [item]))).rows[0]!.id;
    await expectDenied(as(ids.editor, (tx) => tx.query(`select public.delete_wishlist_question($1)`, [other])));
    await as(ids.papa, (tx) => tx.query(`select public.delete_wishlist_question($1)`, [other]));
    await as(ids.rosa, (tx) => tx.query(`select public.delete_wishlist_question($1)`, [question]));
    expect((await list(ids.rosa)).rows).toHaveLength(0);
  });
});

describe('cuentas claras', () => {
  const saveExpense = (userId: string, args: unknown[]) =>
    as(userId, (tx) => tx.query<{ id: string }>(`select public.save_expense($1, $2, $3, $4, $5, $6::uuid[], $7, $8) as id`, args));
  const people = (...list: (string | undefined)[]) => `{${list.join(',')}}`;
  let pavo = '';

  it('cada quien registra lo que pagó, dividido entre varias personas', async () => {
    const r = await saveExpense(ids.rosa, [eventA, 'expense', 'Pavo', 120, participant.rosa, people(participant.rosa, participant.papa, participant.editor), null, null]);
    pavo = r.rows[0]!.id;
    const shares = await db.query(`select 1 from public.expense_shares where expense_id = $1`, [pavo]);
    expect(shares.rows).toHaveLength(3);
  });

  it('el tutor registra lo que pagó su hijo; nadie registra pagos a nombre de otro', async () => {
    await saveExpense(ids.papa, [eventA, 'expense', 'Panetón', 30, participant.nino, people(participant.nino, participant.papa), null, null]);
    await expect(saveExpense(ids.rosa, [eventA, 'expense', 'Hack', 10, participant.papa, people(participant.rosa), null, null])).rejects.toThrow(/FORBIDDEN/);
  });

  it('editores y organizador registran cualquier gasto', async () => {
    await saveExpense(ids.editor, [eventA, 'expense', 'Bebidas', 50, participant.papa, people(participant.papa, participant.rosa), null, null]);
  });

  it('valida montos, personas y pagos', async () => {
    const mine = people(participant.rosa);
    await expect(saveExpense(ids.rosa, [eventA, 'expense', 'X', 0, participant.rosa, mine, null, null])).rejects.toThrow(/AMOUNT_INVALID/);
    await expect(saveExpense(ids.rosa, [eventA, 'expense', 'X', 10.555, participant.rosa, mine, null, null])).rejects.toThrow(/AMOUNT_INVALID/);
    await expect(saveExpense(ids.rosa, [eventA, 'expense', ' ', 10, participant.rosa, mine, null, null])).rejects.toThrow(/EXPENSE_DESCRIPTION_INVALID/);
    await expect(saveExpense(ids.rosa, [eventA, 'expense', 'X', 10, participant.rosa, '{}', null, null])).rejects.toThrow(/EXPENSE_SHARES_REQUIRED/);
    await expect(saveExpense(ids.rosa, [eventA, 'payment', 'Pago', 10, participant.rosa, mine, null, null])).rejects.toThrow(/PAYMENT_RECEIVER_INVALID/);
    const otherEvent = await db.query<{ id: string }>(`select id from public.participants where event_id = $1 limit 1`, [eventB]);
    await expect(saveExpense(ids.rosa, [eventA, 'expense', 'X', 10, participant.rosa, people(otherEvent.rows[0]!.id), null, null])).rejects.toThrow(
      /PARTICIPANT_NOT_FOUND/,
    );
  });

  it('quien recibe un pago también puede registrarlo', async () => {
    // Papá le pagó a Rosa; lo anota Rosa
    await saveExpense(ids.rosa, [eventA, 'payment', 'Pago', 40, participant.papa, people(participant.rosa), null, null]);
  });

  it('solo lo edita o borra quien puede escribirlo', async () => {
    await expect(saveExpense(ids.papa, [eventA, 'expense', 'Pavo', 999, participant.papa, people(participant.papa), null, pavo])).rejects.toThrow(/FORBIDDEN/);
    await expect(as(ids.papa, (tx) => tx.query(`select public.delete_expense($1)`, [pavo]))).rejects.toThrow(/FORBIDDEN/);
    await saveExpense(ids.rosa, [eventA, 'expense', 'Pavo grande', 150, participant.rosa, people(participant.rosa, participant.papa), null, pavo]);
    const shares = await db.query(`select 1 from public.expense_shares where expense_id = $1`, [pavo]);
    expect(shares.rows).toHaveLength(2);
  });

  it('nadie escribe directo en las tablas; la otra Navidad no ve nada', async () => {
    await expectDenied(
      as(ids.rosa, (tx) =>
        tx.query(`insert into public.expenses (event_id, description, amount, paid_by_participant_id) values ($1, 'X', 1, $2)`, [eventA, participant.rosa]),
      ),
    );
    const visible = await as(ids.papa, (tx) => tx.query(`select 1 from public.expenses`));
    expect(visible.rows).toHaveLength(4);
    const other = await as(ids.ownerB, (tx) => tx.query(`select 1 from public.expenses union all select 1 from public.expense_shares`));
    expect(other.rows).toHaveLength(0);
    await expect(as(ids.ownerB, (tx) => tx.query(`select public.delete_expense($1)`, [pavo]))).rejects.toThrow(/NOT_FOUND/);
  });
});

describe('mensajes navideños', () => {
  const write = (userId: string, from: string | undefined, to: string | undefined, body = '¡Feliz Navidad!', anonymous = false) =>
    as(userId, (tx) =>
      tx.query(`insert into public.holiday_messages (event_id, from_participant_id, to_participant_id, body, anonymous) values ($1, $2, $3, $4, $5)`, [
        eventA,
        from,
        to,
        body,
        anonymous,
      ]),
    );
  const received = (userId: string) =>
    as(userId, (tx) =>
      tx.query<{ to_participant_id: string; from_name: string | null; body: string | null; unlocked: boolean }>(
        `select to_participant_id, from_name, body, unlocked from public.list_received_messages($1)`,
        [eventA],
      ),
    );
  const setCelebration = (when: string) => db.query(`update public.events set celebration_at = $1 where id = $2`, [when, eventA]);

  it('la hora de apertura es la medianoche siguiente al día de la celebración, en la zona del evento', async () => {
    const r = await db.query<{ at: Date }>(`select app.event_unlock_at($1) as at`, [eventA]);
    expect(new Date(r.rows[0]!.at).toISOString()).toBe('2026-12-25T05:00:00.000Z'); // 25 dic 00:00 en Lima
  });

  it('cada quien escribe a nombre suyo (o de su hijo), nunca a nombre de otro', async () => {
    await write(ids.rosa, participant.rosa, participant.papa, 'Te quiero, papá');
    await write(ids.papa, participant.nino, participant.rosa, 'De tu sobrino', true);
    await write(ids.editor, participant.editor, participant.nino, 'Para Pedrito');
    await expectDenied(write(ids.rosa, participant.editor, participant.papa));
    await expect(write(ids.rosa, participant.rosa, participant.rosa)).rejects.toThrow(/check constraint/);
  });

  it('antes de la medianoche quien recibe solo sabe que tiene mensajes', async () => {
    const r = await received(ids.papa); // Papá y Pedrito (a su cargo)
    expect(r.rows).toHaveLength(2);
    expect(r.rows.every((m) => m.body === null && m.from_name === null && m.unlocked === false)).toBe(true);
  });

  it('nadie más los lee: ni el organizador ni otros participantes', async () => {
    for (const user of [ids.ownerA, ids.editor]) {
      const direct = await as(user, (tx) => tx.query(`select 1 from public.holiday_messages where from_participant_id = $1`, [participant.rosa]));
      expect(direct.rows).toHaveLength(0);
    }
    const owner = await received(ids.ownerA);
    expect(owner.rows).toHaveLength(0);
    await expect(as(ids.ownerB, (tx) => tx.query(`select * from public.list_received_messages($1)`, [eventA]))).rejects.toThrow(/NOT_A_MEMBER/);
  });

  it('desde la medianoche se leen, con firma salvo los anónimos', async () => {
    await setCelebration('2020-12-24 19:00-05');
    const rosa = await received(ids.rosa);
    expect(rosa.rows).toEqual([{ to_participant_id: participant.rosa, from_name: null, body: 'De tu sobrino', unlocked: true }]);
    const papa = await received(ids.papa);
    expect(papa.rows.find((m) => m.to_participant_id === participant.papa)).toMatchObject({ from_name: 'ROSA GARCÍA', body: 'Te quiero, papá' });
    await setCelebration('2026-12-24 19:00-05');
  });

  it('quien escribió lo cambia o lo borra; quien recibe no', async () => {
    const upd = await as(ids.rosa, (tx) => tx.query(`update public.holiday_messages set body = 'Te quiero mucho' where from_participant_id = $1`, [participant.rosa]));
    expect(upd.affectedRows).toBe(1);
    const del = await as(ids.papa, (tx) => tx.query(`delete from public.holiday_messages where from_participant_id = $1`, [participant.rosa]));
    expect(del.affectedRows).toBe(0);
  });
});

describe('Navidad del próximo año', () => {
  const duplicate = (userId: string, code: string) =>
    as(userId, (tx) =>
      tx.query<{ id: string }>(`select public.duplicate_event($1, 'Navidad García 2027', $2, '2027-12-24 19:00-05', true, true, true, true) as id`, [
        eventA,
        code,
      ]),
    );
  let next = '';

  it('solo el organizador puede crearla', async () => {
    await expectDenied(duplicate(ids.editor, 'GARCIA27X'));
    await expectDenied(duplicate(ids.ownerB, 'GARCIA27Y'));
  });

  it('copia familias, integrantes con sus usuarios y roles, tutores, checklist, aportes y cronograma', async () => {
    const fam = await db.query<{ id: string }>(`insert into public.families (event_id, name, color_key) values ($1, 'GARCÍA', 'red') returning id`, [eventA]);
    await db.query(`update public.participants set family_id = $1 where id = $2`, [fam.rows[0]!.id, participant.rosa]);
    await db.query(`insert into public.checklist_items (event_id, title, scope, family_id) values ($1, 'Traer luces', 'family', $2)`, [eventA, fam.rows[0]!.id]);
    await as(ids.ownerA, (tx) =>
      tx.query(`select public.save_responsibility($1, 'contribution', 'food', 'Pavo navideño', null, '2026-12-23', 'done', null, $2::uuid[], '{}'::uuid[], null)`, [
        eventA,
        `{${participant.rosa}}`,
      ]),
    );

    next = (await duplicate(ids.ownerA, 'garcia 27')).rows[0]!.id;

    const ev = await db.query<{ join_code: string; address: string | null; address_host: string | null; owner_user_id: string }>(
      `select join_code, address, address_host, owner_user_id from public.events where id = $1`,
      [next],
    );
    expect(ev.rows[0]).toEqual({ join_code: 'GARCIA27', address: 'Av. Larco 123, Miraflores', address_host: 'la abuela Rosa', owner_user_id: ids.ownerA });

    const copied = await db.query<{ full_name: string; user_id: string | null; family: string | null }>(
      `select p.full_name, p.user_id, f.name as family
         from public.participants p left join public.families f on f.id = p.family_id
        where p.event_id = $1 order by p.full_name`,
      [next],
    );
    const original = await db.query(`select 1 from public.participants where event_id = $1 and status = 'active'`, [eventA]);
    expect(copied.rows).toHaveLength(original.rows.length);
    expect(copied.rows.find((p) => p.full_name === 'ROSA GARCÍA')).toEqual({ full_name: 'ROSA GARCÍA', user_id: ids.rosa, family: 'GARCÍA' });

    const roles = await db.query<{ user_id: string; role: string }>(`select user_id, role from public.event_members where event_id = $1`, [next]);
    expect(roles.rows.find((r) => r.user_id === ids.editor)?.role).toBe('editor');
    expect(roles.rows.filter((r) => r.role === 'owner')).toEqual([{ user_id: ids.ownerA, role: 'owner' }]);

    const wards = await db.query(`select 1 from public.guardianships where event_id = $1`, [next]);
    expect(wards.rows).toHaveLength(1);

    const checklist = await db.query<{ title: string }>(`select title from public.checklist_items where event_id = $1`, [next]);
    expect(checklist.rows.map((c) => c.title)).toContain('Traer luces');

    const resp = await db.query<{ status: string; due_date: string }>(
      `select status, to_char(due_date, 'YYYY-MM-DD') as due_date from public.responsibilities where event_id = $1 and title = 'Pavo navideño'`,
      [next],
    );
    expect(resp.rows[0]).toEqual({ status: 'pending', due_date: '2027-12-23' });

    const sched = await db.query<{ starts_at: Date }>(`select starts_at from public.schedule_items where event_id = $1`, [next]);
    expect(sched.rows.map((s) => new Date(s.starts_at).toISOString())).toContain('2027-12-25T01:00:00.000Z');
  });

  it('los familiares ven la nueva Navidad con su misma cuenta; no se copian regalos', async () => {
    const mine = await as(ids.rosa, (tx) => tx.query(`select 1 from public.events where id = $1`, [next]));
    expect(mine.rows).toHaveLength(1);
    const wishes = await db.query(`select 1 from public.wishlist_items where event_id = $1`, [next]);
    expect(wishes.rows).toHaveLength(0);
  });

  it('respeta el código único', async () => {
    await expect(duplicate(ids.ownerA, 'GARCIA27')).rejects.toThrow(/JOIN_CODE_TAKEN/);
  });
});
