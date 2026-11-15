import { describe, expect, it, vi } from 'vitest';
import type { IResponsibilityRepository } from '../domain/IResponsibilityRepository';
import type { Responsibility } from '../domain/Responsibility';
import { DEFAULT_FILTERS, ResponsibilityService } from './ResponsibilityService';

const r = (id: string, over: Partial<Responsibility> = {}): Responsibility => ({
  id,
  eventId: 'e',
  kind: 'contribution',
  category: 'food',
  title: id,
  description: null,
  dueDate: null,
  status: 'pending',
  notes: null,
  participantIds: [],
  familyIds: [],
  ...over,
});

const rosa = { id: 'rosa', familyId: 'garcia' };
const juan = { id: 'juan', familyId: 'perez' };
const nino = { id: 'nino', familyId: 'perez' };
const people = [rosa, juan, nino];

describe('mis responsabilidades', () => {
  const items = [
    r('pavo', { participantIds: ['rosa'] }),
    r('deco', { familyIds: ['garcia'], status: 'done' }),
    r('musica', { participantIds: ['juan'] }),
    r('postre', { participantIds: ['nino'], status: 'in_progress' }),
  ];

  it('incluye las asignadas a mí y a mi familia', () => {
    expect(ResponsibilityService.mine(items, [rosa]).map((x) => x.id)).toEqual(['pavo', 'deco']);
  });

  it('un tutor también ve las de sus hijos; primero lo que está en progreso', () => {
    expect(ResponsibilityService.mine(items, [juan, nino]).map((x) => x.id)).toEqual(['postre', 'musica']);
  });

  it('filtra por familia (incluye lo asignado a sus integrantes), persona y estado', () => {
    expect(ResponsibilityService.filter(items, { ...DEFAULT_FILTERS, familyId: 'perez' }, [rosa], people).map((x) => x.id)).toEqual([
      'postre',
      'musica',
    ]);
    expect(ResponsibilityService.filter(items, { ...DEFAULT_FILTERS, participantId: 'rosa' }, [rosa], people).map((x) => x.id)).toEqual([
      'pavo',
      'deco',
    ]);
    expect(ResponsibilityService.filter(items, { ...DEFAULT_FILTERS, status: 'done' }, [rosa], people).map((x) => x.id)).toEqual(['deco']);
  });
});

describe('guardar', () => {
  it('exige título y al menos un responsable, y quita duplicados', async () => {
    const repo: IResponsibilityRepository = { list: vi.fn(), save: vi.fn().mockResolvedValue('id'), remove: vi.fn(), setStatus: vi.fn() };
    const service = new ResponsibilityService(repo);
    const base = {
      id: null,
      eventId: 'e',
      kind: 'contribution' as const,
      category: 'food' as const,
      title: ' Pavo ',
      description: ' ',
      dueDate: null,
      status: 'pending' as const,
      notes: null,
      participantIds: ['a', 'a'],
      familyIds: [],
    };
    await service.save(base);
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ title: 'Pavo', description: null, participantIds: ['a'] }));
    await expect(service.save({ ...base, title: '  ' })).rejects.toMatchObject({ code: 'RESPONSIBILITY_TITLE_INVALID' });
    await expect(service.save({ ...base, participantIds: [] })).rejects.toMatchObject({ code: 'RESPONSIBLE_REQUIRED' });
  });
});
