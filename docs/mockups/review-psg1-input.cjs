// Standalone TS-source regression checks; no native device/network required.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
function load(file, deps = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const context = { exports: {}, require: () => deps };
  vm.runInNewContext(code, context);
  return context.exports;
}
const { InputControl } = load('src/input/InputControl.ts');
const { MenuInputContext } = load('src/input/contexts/MenuInputContext.ts', { InputControl });
assert.equal(MenuInputContext.PreviousTab[0], InputControl.PreviousTab);
assert.equal(MenuInputContext.NextTab[0], InputControl.NextTab);
assert.equal(InputControl.PowerFour, 12); // Existing stored bindings retain their IDs.
const deps = {
  InputControl,
  ...load('src/core/input/InputBinding.ts'),
  ...load('src/core/input/codes/KeyboardButtonCode.ts'),
  ...load('src/core/input/codes/GamepadButtonCode.ts'),
};
for (const name of ['PrimaryKeyboardInputBinding', 'PrimaryGamepadInputBinding', 'SecondaryGamepadInputBinding']) {
  const Binding = load('src/input/bindings/' + name + '.ts', deps)[name];
  const binding = new Binding();
  assert.equal(binding.get(InputControl.PreviousTab), name.includes('Keyboard') ? deps.KeyboardButtonCode.L : deps.GamepadButtonCode.LeftBumper);
  assert.equal(binding.get(InputControl.NextTab), name.includes('Keyboard') ? deps.KeyboardButtonCode.R : deps.GamepadButtonCode.RightBumper);
}
const { NativeAndroidGamepad } = load('src/input/mobile/NativeAndroidGamepad.ts', { InputControl });
const pressed = new Map();
const gamepad = new NativeAndroidGamepad((key, state) => pressed.set(key, state));
gamepad.deviceProfile = {model:'PSG1'};
const send = (control, state) => gamepad.handleNativeEvent({detail:{type:'button',control,pressed:state}});
send('button_l1', true);
assert.equal(pressed.get(InputControl.PreviousTab), true);
assert.equal(pressed.get(InputControl.PrimaryAction), false);
send('button_l1', false);
assert.equal(pressed.get(InputControl.PreviousTab), false);
send('r1', true);
assert.equal(pressed.get(InputControl.NextTab), true);
gamepad.handleNativeEvent({detail:{type:'reset'}});
assert.equal(pressed.get(InputControl.NextTab), false);
gamepad.deviceProfile = {model:'Seeker'};
send('l1', true);
send('r1', true);
assert.equal(pressed.get(InputControl.PreviousTab), false);
assert.equal(pressed.get(InputControl.NextTab), false);
console.log('PASS: keyboard/browser gamepad mappings, native PSG1 shoulders, release/reset and non-PSG isolation.');
