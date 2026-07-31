import test from 'ava';

import { Session } from '../game';

import { prepareLevelSession } from './LevelMatchLifecycle';

test('run extra lives are applied only once across stage transitions', (t) => {
  const session = new Session();
  session.setMultiplayer();
  session.setRunConsumables({
    powerups: [],
    powerupItems: [],
    powerupCounts: [],
    extraLives: 2,
  });

  prepareLevelSession(session, 20);
  t.deepEqual(
    session.getPlayers().map((player) => player.getLivesCount()),
    [5, 5],
  );

  session.activateNextLevel();
  prepareLevelSession(session, 20);
  t.deepEqual(
    session.getPlayers().map((player) => player.getLivesCount()),
    [5, 5],
    'starting another stage must carry lives without granting the loadout bonus again',
  );
});
