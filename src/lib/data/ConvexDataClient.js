export class ConvexDataClient {
  constructor(options = {}) {
    this.kind = 'convex';
    this.options = options;
  }

  unavailable() {
    throw new Error('Convex data client is not configured yet. Use local mode until Convex functions and auth are added.');
  }

  records = {
    hasData: () => this.unavailable(),
    count: () => this.unavailable(),
    countByType: () => this.unavailable(),
    summary: () => this.unavailable(),
    get: () => this.unavailable(),
    getMany: () => this.unavailable(),
    all: () => this.unavailable(),
    query: () => this.unavailable(),
    save: () => this.unavailable(),
    saveMany: () => this.unavailable(),
    delete: () => this.unavailable(),
    transaction: () => this.unavailable(),
    importDataset: () => this.unavailable(),
    clearAll: () => this.unavailable(),
  };

  assets = {
    save: () => this.unavailable(),
    get: () => this.unavailable(),
    delete: () => this.unavailable(),
    listForRecord: () => this.unavailable(),
    listAll: () => this.unavailable(),
    count: () => this.unavailable(),
  };

  meta = {
    get: () => this.unavailable(),
    set: () => this.unavailable(),
  };
}

export function createConvexDataClient(options) {
  return new ConvexDataClient(options);
}
