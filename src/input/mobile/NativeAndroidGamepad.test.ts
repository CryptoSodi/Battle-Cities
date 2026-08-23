import test from 'ava';

import {
  AndroidDeviceProfile,
  isPlaySolanaPsg1,
  isSolanaSeeker,
} from './NativeAndroidGamepad';

function profile(
  overrides: Partial<AndroidDeviceProfile>,
): AndroidDeviceProfile {
  return {
    deviceId: 'test-device',
    manufacturer: 'Generic',
    brand: 'Generic',
    model: 'Android Phone',
    device: 'generic',
    product: 'generic',
    osRelease: '15',
    sdkVersion: 35,
    ...overrides,
  };
}

test('detects the documented Solana Seeker model', (t) => {
  t.true(
    isSolanaSeeker(
      profile({
        manufacturer: 'Solana Mobile Inc.',
        brand: 'solanamobile',
        model: 'Seeker',
        device: 'seeker',
        product: 'seeker',
      }),
    ),
  );
  t.false(isSolanaSeeker(profile({ model: 'Seeker Pro' })));
});

test('detects PSG1 across model, device, and product build fields', (t) => {
  t.true(isPlaySolanaPsg1(profile({ model: 'PSG1' })));
  t.true(isPlaySolanaPsg1(profile({ device: 'PSG1' })));
  t.true(isPlaySolanaPsg1(profile({ product: 'Play Solana Gen1' })));
  t.true(
    isPlaySolanaPsg1(
      profile({ manufacturer: 'Play Solana', model: 'Gen1 Handheld' }),
    ),
  );
  t.false(isPlaySolanaPsg1(profile({ model: 'Seeker' })));
  t.false(isPlaySolanaPsg1(profile({ model: 'PSG2' })));
});
