import { describe, it, expect } from 'vitest';
import { collaboratorsFromAwareness, pickUserColor } from './awareness-collaborators';

const user = { name: 'Uczeń', color: pickUserColor(2) };

describe('collaboratorsFromAwareness', () => {
  it('pomija własny clientID i klientów bez tożsamości', () => {
    const states = new Map<number, unknown>([
      [1, { user: { name: 'Ja', color: pickUserColor(1) } }],
      [2, { user, pointer: { x: 5, y: 6, tool: 'pointer' }, button: 'down' }],
      [3, {}],
    ]);
    const out = collaboratorsFromAwareness({ clientID: 1, getStates: () => states });

    expect([...out.keys()]).toEqual(['2']);
    expect(out.get('2' as never)).toMatchObject({
      id: '2',
      username: 'Uczeń',
      pointer: { x: 5, y: 6, tool: 'pointer' },
      button: 'down',
    });
  });

  it('brak przycisku w stanie -> "up"', () => {
    const states = new Map<number, unknown>([[7, { user }]]);
    const out = collaboratorsFromAwareness({ clientID: 1, getStates: () => states });
    expect(out.get('7' as never)?.button).toBe('up');
  });
});

describe('pickUserColor', () => {
  it('jest deterministyczne i działa dla ujemnych id (goście demo)', () => {
    expect(pickUserColor(-5)).toEqual(pickUserColor(5));
    expect(pickUserColor(4)).toEqual(pickUserColor(4));
  });
});
