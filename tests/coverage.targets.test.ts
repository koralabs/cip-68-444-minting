import assert from 'node:assert/strict';
import test from 'node:test';

import { Color } from './colors.ts';

test('Color map exposes expected ANSI reset and foreground codes', () => {
    assert.equal(Color.Reset, '\x1b[0m');
    assert.equal(Color.FgGreen, '\x1b[32m');
    assert.equal(Color.FgRed, '\x1b[31m');
    assert.equal(Color.BgBlue, '\x1b[44m');
});

test('Color map keys are unique and every value is an ANSI string', () => {
    const keys = Object.keys(Color);
    const values = Object.values(Color);

    assert.ok(keys.length > 0);
    assert.equal(new Set(keys).size, keys.length);
    values.forEach((value) => {
        assert.equal(typeof value, 'string');
        assert.ok(value.startsWith('\x1b['));
        assert.ok(value.endsWith('m'));
    });
});
