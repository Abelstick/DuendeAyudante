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
