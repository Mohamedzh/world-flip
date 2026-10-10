import { describe, expect, it } from 'vitest';
import { PowerSystem, PowerTrigger } from '../src/systems/powers';

const cooldowns = { fire: 3000, water: 4000, snow: 5000, wind: 4000 };

describe('PowerSystem', () => {
  it('starts with no powers and nothing to use', () => {
    const p = new PowerSystem(cooldowns);
    expect(p.active).toBeNull();
    expect(p.useActive(0)).toBeNull();
  });

  it('a newly earned power becomes active and is ready at once', () => {
    const p = new PowerSystem(cooldowns);
    expect(p.grant('fire')).toBe(true);
    expect(p.active).toBe('fire');
    expect(p.useActive(0)).toBe('fire');
  });

  it('at the boss, K picks a ready power that still breaks a shield piece', () => {
    const p = new PowerSystem(cooldowns, ['fire', 'water', 'snow', 'wind']);
    p.select('fire');
    // Fire's piece is already broken: water is the first one wanted.
    expect(p.useFirstReady(['water', 'snow'], 0)).toBe('water');
    expect(p.active).toBe('water');
    // Water is cooling down, so the next one goes to snow.
    expect(p.useFirstReady(['water', 'snow'], 100)).toBe('snow');
    // The active power goes first when it's wanted and ready.
    p.select('wind');
    expect(p.useFirstReady(['water', 'wind'], 5000)).toBe('wind');
    // Nothing wanted is ready: nothing happens.
    expect(p.useFirstReady(['snow'], 200)).toBeNull();
  });

  it('earning a power twice changes nothing', () => {
    const p = new PowerSystem(cooldowns, ['fire']);
    expect(p.grant('fire')).toBe(false);
    expect(p.ownedPowers).toEqual(['fire']);
  });

  it('uses the cooldown from the spec: fire 3 s', () => {
    const p = new PowerSystem(cooldowns, ['fire']);
    p.useActive(1000);
    expect(p.useActive(3999)).toBeNull();
    expect(p.readiness('fire', 2500)).toBeCloseTo(0.5);
    expect(p.useActive(4000)).toBe('fire');
  });

  it('switches between owned powers, in element order', () => {
    const p = new PowerSystem(cooldowns, ['snow', 'fire']);
    expect(p.ownedPowers).toEqual(['fire', 'snow']);
    p.select('fire');
    p.cycle();
    expect(p.active).toBe('snow');
    p.cycle();
    expect(p.active).toBe('fire');
    expect(p.select('wind')).toBe(false);
    expect(p.active).toBe('fire');
  });

  it('each power has its own cooldown', () => {
    const p = new PowerSystem(cooldowns, ['fire', 'snow']);
    p.select('fire');
    p.useActive(0);
    p.select('snow');
    expect(p.useActive(10)).toBe('snow');
  });
});

describe('PowerTrigger', () => {
  it('tapping K casts when K is released', () => {
    const t = new PowerTrigger();
    expect(t.update(true, false)).toBe('none');
    expect(t.update(true, false)).toBe('none');
    expect(t.update(false, false)).toBe('cast');
    expect(t.update(false, false)).toBe('none');
  });

  it('holding K and pressing J charges the weapon instead of casting', () => {
    const t = new PowerTrigger();
    t.update(true, false);
    expect(t.update(true, true)).toBe('chargeWeapon');
    expect(t.update(true, true)).toBe('none'); // only once per hold
    expect(t.update(false, false)).toBe('none'); // no cast after using it on the weapon
  });

  it('pressing J without K does nothing here', () => {
    const t = new PowerTrigger();
    expect(t.update(false, true)).toBe('none');
  });
});
