export function tabBarMetrics(bottomInset = 0) {
  const safeBottom = Math.max(0, Number(bottomInset) || 0);
  return {
    height: 59 + safeBottom,
    paddingTop: 7,
    paddingBottom: Math.max(7, safeBottom)
  };
}

/** @returns {'padding' | undefined} */
export function keyboardAvoidingBehavior(platform) {
  return platform === 'ios' ? 'padding' : undefined;
}
