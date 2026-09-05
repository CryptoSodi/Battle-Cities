import test from 'ava';

import {
  AndroidDeviceProfile,
  isPlaySolanaPsg1,
  isSolanaSeeker,
  NativeAndroidGamepad,
} from './NativeAndroidGamepad';
import { InputControl } from '../InputControl';

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

test('maps Start and Menu buttons to the shared menu select control', (t) => {
  const changes: Array<[InputControl, boolean]> = [];
  const gamepad = new NativeAndroidGamepad((control, pressed) =>
    changes.push([control, pressed]),
  );

  (gamepad as any).handleNativeEvent({
    detail: { type: 'button', control: 'button_start', pressed: true },
  });

  t.true(
    changes.some(
      ([control, pressed]) =>
        control === InputControl.Select && pressed === true,
    ),
  );
});

test('maps PSG1 A to confirm and B to menu back', (t) => {
  const changes: Array<[InputControl, boolean]> = [];
  const gamepad = new NativeAndroidGamepad((control, pressed) =>
    changes.push([control, pressed]),
  );
  const dispatch = (control: string) =>
    (gamepad as any).handleNativeEvent({
      detail: {
        type: 'button',
        control,
        pressed: true,
      },
    });

  dispatch('button_a');
  dispatch('button_b');

  t.true(
    changes.some(
      ([control, pressed]) =>
        control === InputControl.PrimaryAction && pressed === true,
    ),
  );
  t.true(
    changes.some(
      ([control, pressed]) =>
        control === InputControl.SecondaryAction && pressed === true,
    ),
  );
});

test('maps PSG1 right-stick directions to equipped power slots', (t) => {
  const changes: Array<[InputControl, boolean]> = [];
  const gamepad = new NativeAndroidGamepad((control, pressed) =>
    changes.push([control, pressed]),
  );
  (gamepad as any).deviceProfile = profile({ model: 'PSG1' });
  const axes = (rightX: number, rightY: number) => ({
    leftX: 0,
    leftY: 0,
    rightX,
    rightY,
    hatX: 0,
    hatY: 0,
    leftTrigger: 0,
    rightTrigger: 0,
  });
  const dispatch = (rightX: number, rightY: number) =>
    (gamepad as any).handleNativeEvent({
      detail: { type: 'axes', axes: axes(rightX, rightY) },
    });

  dispatch(1, 0);
  dispatch(0, -1);
  dispatch(0, 1);
  dispatch(-1, 0);

  [
    InputControl.PowerOne,
    InputControl.PowerTwo,
    InputControl.PowerThree,
    InputControl.PowerFour,
  ].forEach((control) =>
    t.true(changes.some(([changed, pressed]) => changed === control && pressed)),
  );
});

test('maps PlayStation right-stick directions to equipped power slots', (t) => {
  const changes: Array<[InputControl, boolean]> = [];
  const gamepad = new NativeAndroidGamepad((control, pressed) =>
    changes.push([control, pressed]),
  );
  const axes = (rightX: number, rightY: number) => ({
    leftX: 0,
    leftY: 0,
    rightX,
    rightY,
    hatX: 0,
    hatY: 0,
    leftTrigger: 0,
    rightTrigger: 0,
  });
  const dispatch = (rightX: number, rightY: number) =>
    (gamepad as any).handleNativeEvent({
      detail: {
        type: 'axes',
        axes: axes(rightX, rightY),
        device: {
          id: 1,
          name: 'Wireless Controller',
          vendorId: 0x054c,
          productId: 0x0ce6,
        },
      },
    });

  dispatch(1, 0);
  dispatch(0, -1);
  dispatch(0, 1);
  dispatch(-1, 0);

  [
    InputControl.PowerOne,
    InputControl.PowerTwo,
    InputControl.PowerThree,
    InputControl.PowerFour,
  ].forEach((control) =>
    t.true(changes.some(([changed, pressed]) => changed === control && pressed)),
  );
});
