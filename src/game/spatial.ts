/** Grade espacial uniforme: consultas por raio em O(células) em vez de O(n). */
export class SpatialGrid<T extends { x: number; y: number }> {
  private readonly buckets: T[][];
  private readonly cols: number;
  private readonly rows: number;
  private readonly offset: number;

  constructor(
    private readonly cell: number,
    width: number,
    height: number,
    margin = 128,
  ) {
    this.offset = margin;
    this.cols = Math.ceil((width + margin * 2) / cell);
    this.rows = Math.ceil((height + margin * 2) / cell);
    this.buckets = Array.from({ length: this.cols * this.rows }, () => []);
  }

  clear(): void {
    for (const b of this.buckets) b.length = 0;
  }

  private cx(x: number): number {
    const c = Math.floor((x + this.offset) / this.cell);
    return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c;
  }

  private cy(y: number): number {
    const r = Math.floor((y + this.offset) / this.cell);
    return r < 0 ? 0 : r >= this.rows ? this.rows - 1 : r;
  }

  insert(item: T): void {
    this.buckets[this.cy(item.y) * this.cols + this.cx(item.x)].push(item);
  }

  /** Itens nas células que tocam o círculo (o chamador faz o teste fino de distância). */
  query(x: number, y: number, r: number, out: T[]): T[] {
    out.length = 0;
    const x0 = this.cx(x - r);
    const x1 = this.cx(x + r);
    const y0 = this.cy(y - r);
    const y1 = this.cy(y + r);
    for (let row = y0; row <= y1; row++) {
      for (let col = x0; col <= x1; col++) {
        const b = this.buckets[row * this.cols + col];
        for (let i = 0; i < b.length; i++) out.push(b[i]);
      }
    }
    return out;
  }
}
