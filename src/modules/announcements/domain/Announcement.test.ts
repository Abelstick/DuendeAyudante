import { describe, expect, it } from 'vitest';
import { type Announcement, announcementShareText, announcementsForHome, pinnedAnnouncement } from './Announcement';

const a = (id: string, day: number, priority: Announcement['priority'] = 'normal', pinned = false): Announcement => ({
  id,
  eventId: 'e',
  title: `T${id}`,
  body: 'Cuerpo',
  priority,
  pinned,
  authorName: 'ABEL PÉREZ',
  publishedAt: new Date(Date.UTC(2026, 11, day)),
});

describe('anuncios en Inicio', () => {
  it('primero los importantes, luego los más recientes, hasta 3', () => {
    const list = [a('viejo', 1), a('imp-viejo', 2, 'important'), a('nuevo', 10), a('imp-nuevo', 5, 'important'), a('medio', 6)];
    expect(announcementsForHome(list).map((x) => x.id)).toEqual(['imp-nuevo', 'imp-viejo', 'nuevo']);
  });

  it('el fijado sale aparte y no se repite en la tarjeta de anuncios', () => {
    const list = [a('nuevo', 10), a('fijado', 1, 'normal', true), a('imp', 5, 'important')];
    expect(pinnedAnnouncement(list)?.id).toBe('fijado');
    expect(announcementsForHome(list).map((x) => x.id)).toEqual(['imp', 'nuevo']);
  });

  it('sin fijado no hay banner', () => {
    expect(pinnedAnnouncement([a('1', 1)])).toBeNull();
  });

  it('arma el texto para compartir por WhatsApp', () => {
    expect(announcementShareText(a('1', 1), 'Navidad García')).toBe('📢 Navidad García\n\n*T1*\nCuerpo\n\n— ABEL PÉREZ');
  });
});
