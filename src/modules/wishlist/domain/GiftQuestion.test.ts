import { describe, expect, it } from 'vitest';
import { countPending, itemsWithNewAnswers, questionStatsByOwner, sumStats, type GiftQuestion } from './GiftQuestion';

const q = (over: Partial<GiftQuestion>): GiftQuestion => ({
  id: 'q',
  itemId: 'a',
  question: '¿Qué talla?',
  answer: null,
  createdAt: new Date('2026-12-01'),
  answeredAt: null,
  isMine: false,
  answerUnseen: false,
  ...over,
});

describe('preguntas sobre regalos', () => {
  it('cuenta las que siguen sin respuesta solo en mis regalos', () => {
    const list = [q({ itemId: 'a' }), q({ itemId: 'a', answer: '42' }), q({ itemId: 'b' }), q({ itemId: 'c' })];
    expect(countPending(list, new Set(['a', 'b']))).toBe(2);
    expect(countPending(list, new Set())).toBe(0);
  });

  it('cuenta las preguntas por dueño del regalo e ignora regalos que ya no existen', () => {
    const owners = new Map([
      ['a', 'ana'],
      ['b', 'ana'],
      ['c', 'beto'],
    ]);
    const list = [q({ itemId: 'a' }), q({ itemId: 'b', answer: 'M' }), q({ itemId: 'c' }), q({ itemId: 'x' })];
    const stats = questionStatsByOwner(list, owners);
    expect(stats.get('ana')).toEqual({ total: 2, pending: 1 });
    expect(stats.get('beto')).toEqual({ total: 1, pending: 1 });
    expect(stats.has('x')).toBe(false);
    expect(sumStats(stats.values())).toEqual({ total: 3, pending: 2 });
  });

  it('agrupa por regalo las respuestas nuevas a mis preguntas', () => {
    const list = [
      q({ itemId: 'a', isMine: true, answer: '42', answerUnseen: true }),
      q({ itemId: 'a', isMine: true, answer: 'Azul', answerUnseen: true }),
      q({ itemId: 'b', isMine: true, answer: 'Sí' }),
      q({ itemId: 'c' }),
    ];
    expect(itemsWithNewAnswers(list)).toEqual(['a']);
  });
});
