import test from 'node:test';
import assert from 'node:assert/strict';
import { updateAutoFollowFromScroll } from './chatScrollState.js';

test('chat follows while user is near bottom', () => {
    assert.deepEqual(updateAutoFollowFromScroll({ scrollHeight: 1000, scrollTop: 420, clientHeight: 500 }), { autoFollow: true, showScrollToBottom: false });
});

test('manual upward scroll stops follow and shows the return button', () => {
    assert.deepEqual(updateAutoFollowFromScroll({ scrollHeight: 1000, scrollTop: 200, clientHeight: 500 }), { autoFollow: false, showScrollToBottom: true });
});

test('additional content does not re-enable follow while position remains away from bottom', () => {
    assert.equal(updateAutoFollowFromScroll({ scrollHeight: 1400, scrollTop: 200, clientHeight: 500 }).autoFollow, false);
});

test('returning near bottom resumes follow', () => {
    assert.equal(updateAutoFollowFromScroll({ scrollHeight: 1400, scrollTop: 820, clientHeight: 500 }).autoFollow, true);
});
