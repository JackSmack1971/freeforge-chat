import test from 'node:test';
import assert from 'node:assert/strict';

import { esc, maskKey } from '../../freeforge/src/state.js';

test('esc escapes angle brackets, ampersands, and double quotes', () => {
  assert.equal(esc('<script src="x">& "quoted"</script>'), '&lt;script src=&quot;x&quot;&gt;&amp; &quot;quoted&quot;&lt;/script&gt;');
});

test('esc coerces non-string input before escaping', () => {
  assert.equal(esc(42), '42');
});

test('maskKey hides short and missing keys completely', () => {
  assert.equal(maskKey('short'), '••••••••');
  assert.equal(maskKey(null), '••••••••');
});

test('maskKey preserves the leading and trailing segments of long keys', () => {
  assert.equal(maskKey('sk-or-v1-abcdefgh1234'), 'sk-or-••••••••••••1234');
});
