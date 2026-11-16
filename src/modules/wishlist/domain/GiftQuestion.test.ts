import { describe, expect, it } from 'vitest';
import { countPending, itemsWithNewAnswers, type GiftQuestion } from './GiftQuestion';

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
