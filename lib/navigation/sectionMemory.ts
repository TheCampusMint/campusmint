export type SectionVisitResult = {
  scrollY: number;
  refreshGeneration: number;
  refreshed: boolean;
};

/**
 * Keeps a deliberately small LRU of settled main-section visits.
 * Rendering an offscreen neighbor never calls commit(), so it cannot
 * become recent or displace a tab the user actually visited.
 */
export class SectionMemory<Section extends string> {
  private readonly maxRetained: number;
  private readonly visited = new Set<Section>();
  private readonly scrollPositions = new Map<Section, number>();
  private readonly refreshGenerations = new Map<Section, number>();
  private retained: Section[];

  constructor(initialSection: Section, maxRetained = 2) {
    this.maxRetained = Math.max(1, maxRetained);
    this.visited.add(initialSection);
    this.scrollPositions.set(initialSection, 0);
    this.refreshGenerations.set(initialSection, 0);
    this.retained = [initialSection];
  }

  capture(section: Section, scrollY: number) {
    if (!this.retained.includes(section)) return;

    this.scrollPositions.set(
      section,
      Math.max(0, Number.isFinite(scrollY) ? scrollY : 0),
    );
  }

  commit(section: Section): SectionVisitResult {
    const wasVisited = this.visited.has(section);
    const wasRetained = this.retained.includes(section);
    const refreshed = wasVisited && !wasRetained;

    if (refreshed) {
      this.scrollPositions.set(section, 0);
      this.refreshGenerations.set(
        section,
        this.getRefreshGeneration(section) + 1,
      );
    } else if (!wasVisited) {
      this.scrollPositions.set(section, 0);
      this.refreshGenerations.set(section, 0);
    }

    this.visited.add(section);
    this.retained = [
      section,
      ...this.retained.filter((candidate) => candidate !== section),
    ].slice(0, this.maxRetained);

    return {
      scrollY: this.getScrollY(section),
      refreshGeneration: this.getRefreshGeneration(section),
      refreshed,
    };
  }

  refresh(section: Section): SectionVisitResult {
    this.visited.add(section);
    this.scrollPositions.set(section, 0);
    this.refreshGenerations.set(
      section,
      this.getRefreshGeneration(section) + 1,
    );

    return {
      scrollY: 0,
      refreshGeneration: this.getRefreshGeneration(section),
      refreshed: true,
    };
  }

  getScrollY(section: Section) {
    if (!this.retained.includes(section)) return 0;
    return this.scrollPositions.get(section) ?? 0;
  }

  getRefreshGeneration(section: Section) {
    return this.refreshGenerations.get(section) ?? 0;
  }

  getRetainedSections() {
    return [...this.retained];
  }
}
