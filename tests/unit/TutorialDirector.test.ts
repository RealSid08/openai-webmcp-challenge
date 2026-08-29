import { TutorialDirector } from '../../src/tutorial/TutorialDirector';

describe('TutorialDirector', () => {
  it('advances only when the matching real action occurs', () => {
    const tutorial = new TutorialDirector({ completedBefore: false });
    expect(tutorial.getSnapshot().step).toBe('MOVE');
    tutorial.record({ type: 'AIMED' });
    expect(tutorial.getSnapshot().step).toBe('MOVE');
    tutorial.record({ type: 'MOVED' });
    expect(tutorial.getSnapshot().step).toBe('AIM');
    tutorial.record({ type: 'AIMED' });
    tutorial.record({ type: 'HIT_ENEMY' });
    tutorial.record({ type: 'CALLOUT_SENT' });
    tutorial.record({ type: 'CHARACTER_SWITCHED' });
    expect(tutorial.getSnapshot()).toMatchObject({ active: false, step: 'COMPLETE', completed: true });
  });

  it('requires a deliberate hold before skipping', () => {
    const tutorial = new TutorialDirector({ completedBefore: false, skipHoldSeconds: 0.75 });
    tutorial.updateSkipHeld(true, 0.4);
    expect(tutorial.getSnapshot().active).toBe(true);
    tutorial.updateSkipHeld(false, 0.1);
    expect(tutorial.getSnapshot().skipProgress).toBe(0);
    tutorial.updateSkipHeld(true, 0.8);
    expect(tutorial.getSnapshot()).toMatchObject({ active: false, skipped: true });
  });

  it('uses a single optional refresher for returning players', () => {
    const tutorial = new TutorialDirector({ completedBefore: true });
    expect(tutorial.getSnapshot()).toMatchObject({ active: false, step: 'COMPLETE', refresher: true });
  });
});
