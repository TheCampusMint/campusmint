export const motion = {
  duration: {
    instant: 0,
    micro: 120,
    fast: 180,
    standard: 240,
    panelEnter: 300,
    scene: 360,
    settle: 400,
  },
  easing: {
    standard: "cubic-bezier(.2,.8,.2,1)",
    enter: "cubic-bezier(.16,1,.3,1)",
    exit: "cubic-bezier(.4,0,1,1)",
    settle: "cubic-bezier(.2,.9,.24,1)",
  },
} as const;

export type GestureAxis = "pending" | "horizontal" | "vertical";

export type GestureAxisOptions = {
  threshold?: number;
  dominance?: number;
};

/**
 * Locks a gesture only after it has cleared a small dead zone and shown a
 * deliberate axis. Ambiguous diagonal movement remains pending so a slight
 * thumb drift does not steal vertical scrolling or a horizontal carousel.
 */
export function resolveGestureAxis(
  deltaX: number,
  deltaY: number,
  options: GestureAxisOptions = {},
): GestureAxis {
  const threshold = options.threshold ?? 8;
  const dominance = options.dominance ?? 1.2;
  const absoluteX = Math.abs(deltaX);
  const absoluteY = Math.abs(deltaY);

  if (Math.max(absoluteX, absoluteY) < threshold) return "pending";
  if (absoluteX > absoluteY * dominance) return "horizontal";
  if (absoluteY > absoluteX * dominance) return "vertical";
  return "pending";
}

export type NotchPresentation = "expanded" | "compact" | "dots";

export type NotchScrollState = {
  presentation: NotchPresentation;
  lastY: number;
  direction: "up" | "down" | null;
  travel: number;
};

export const initialNotchScrollState: NotchScrollState = {
  presentation: "expanded",
  lastY: 0,
  direction: null,
  travel: 0,
};

export type NotchScrollOptions = {
  topZone?: number;
  collapseStart?: number;
  collapseTravel?: number;
  dotsStart?: number;
  dotsTravel?: number;
  expandTravel?: number;
  jitter?: number;
};

/**
 * A small scroll-state machine with hysteresis. It intentionally ignores
 * trackpad noise, requires sustained travel before changing shape, and always
 * returns the navigation notch to its full form near the top of the page.
 */
export function updateNotchScrollState(
  state: NotchScrollState,
  rawScrollY: number,
  options: NotchScrollOptions = {},
): NotchScrollState {
  const topZone = options.topZone ?? 24;
  const collapseStart = options.collapseStart ?? 72;
  const collapseTravel = options.collapseTravel ?? 52;
  const dotsStart = options.dotsStart ?? 150;
  const dotsTravel = options.dotsTravel ?? 64;
  const expandTravel = options.expandTravel ?? 34;
  const jitter = options.jitter ?? 2;
  const nextY = Math.max(0, rawScrollY);
  const delta = nextY - state.lastY;

  if (nextY <= topZone) {
    return {
      presentation: "expanded",
      lastY: nextY,
      direction: null,
      travel: 0,
    };
  }

  if (Math.abs(delta) <= jitter) {
    return { ...state, lastY: nextY };
  }

  const direction = delta > 0 ? "down" : "up";
  const travel =
    state.direction === direction
      ? state.travel + Math.abs(delta)
      : Math.abs(delta);

  if (
    state.presentation === "expanded" &&
    direction === "down" &&
    nextY >= collapseStart &&
    travel >= collapseTravel
  ) {
    return { presentation: "compact", lastY: nextY, direction, travel: 0 };
  }

  if (state.presentation === "compact" && direction === "down" && nextY >= dotsStart && travel >= dotsTravel) {
    return { presentation: "dots", lastY: nextY, direction, travel: 0 };
  }

  if (state.presentation === "dots" && direction === "up" && travel >= expandTravel) {
    return { presentation: "compact", lastY: nextY, direction, travel: 0 };
  }

  if (state.presentation === "compact" && direction === "up" && travel >= expandTravel) {
    return { presentation: "expanded", lastY: nextY, direction, travel: 0 };
  }

  return { ...state, lastY: nextY, direction, travel };
}

export function expandNotchPresentation(presentation: NotchPresentation) {
  return presentation === "dots" ? "compact" as const : "expanded" as const;
}

export function getNotchDotAvailability(currentIndex: number, sectionCount: number) {
  return { hasPrevious: currentIndex > 0, hasNext: currentIndex < sectionCount - 1 };
}

export function durationForMotion(
  duration: number,
  reducedMotion: boolean,
) {
  return reducedMotion ? 0 : duration;
}

export function clampNavigationIndex(index: number, sectionCount: number) {
  if (sectionCount <= 0) return 0;
  return Math.min(sectionCount - 1, Math.max(0, index));
}

/**
 * Applies a short, rubber-band style resistance when a page drag reaches the
 * first or last primary section. Positive progress travels toward the
 * previous section; negative progress travels toward the next section.
 */
export function resistFiniteNavigationEdge(
  progress: number,
  currentIndex: number,
  sectionCount: number,
  resistance = 0.2,
) {
  const atFirst = currentIndex <= 0 && progress > 0;
  const atLast = currentIndex >= sectionCount - 1 && progress < 0;

  return atFirst || atLast ? progress * resistance : progress;
}

export function resolveFiniteNavigationDestination(
  currentIndex: number,
  swipeTarget: -1 | 0 | 1,
  sectionCount: number,
) {
  // A negative swipe moves the track left and advances to the next section.
  return clampNavigationIndex(currentIndex - swipeTarget, sectionCount);
}
