export const DEFAULT_NEAR_BOTTOM_PX = 100;

export function isChatNearBottom({ scrollHeight, scrollTop, clientHeight }, threshold = DEFAULT_NEAR_BOTTOM_PX) {
    return scrollHeight - scrollTop - clientHeight <= threshold;
}

export function updateAutoFollowFromScroll(metrics, threshold = DEFAULT_NEAR_BOTTOM_PX) {
    const autoFollow = isChatNearBottom(metrics, threshold);
    return { autoFollow, showScrollToBottom: !autoFollow };
}
