export class Block {
    constructor(
        public readonly source: string,
        public readonly start: number = 0,
        public readonly end: number = source.length
    ) {}

    static fromString(source: string, start: number = 0, end?: number): Block {
        return new Block(source, start, end ?? source.length);
    }

    get extracted(): string {
        return this.isValid ? this.source.substring(this.start, this.end) : '';
    }

    get isValid(): boolean {
        return this.start >= 0 && this.end >= 0 && this.start <= this.end;
    }

    get length(): number {
        return this.end - this.start;
    }

    extract(blockStart: string, blockEnd: string): Block {
        const startIndex = this.source.indexOf(blockStart, this.start);
        if (startIndex === -1 || startIndex >= this.end) {
            return Block.invalid();
        }

        const searchStart = startIndex + blockStart.length;
        const endIndex = this.source.lastIndexOf(blockEnd, this.end - 1);
        
        if (endIndex === -1 || endIndex < searchStart) {
            return Block.invalid();
        }

        const contentStartIndex = startIndex + blockStart.length;
        return new Block(this.source, contentStartIndex, endIndex);
    }

    extractAll(blockStart: string, blockEnd: string): Block[] {
        const starts = this.allIndicesOf(blockStart);
        const ends = this.allIndicesOf(blockEnd);

        const markers: Array<{ index: number; isStart: boolean }> = [];
        starts.forEach(index => markers.push({ index, isStart: true }));
        ends.forEach(index => markers.push({ index, isStart: false }));
        markers.sort((a, b) => a.index - b.index);

        const filteredBlocks: number[] = [];
        let previousIsStart = false;
        
        for (const marker of markers) {
            if (marker.isStart) {
                if (!previousIsStart) {
                    filteredBlocks.push(marker.index);
                    previousIsStart = true;
                }
            } else {
                if (filteredBlocks.length === 0) continue;
                if (previousIsStart) {
                    filteredBlocks.push(marker.index);
                } else {
                    filteredBlocks[filteredBlocks.length - 1] = marker.index;
                }
                previousIsStart = false;
            }
        }

        const results: Block[] = [];
        for (let i = 0; i < filteredBlocks.length - 1; i += 2) {
            const startIndex = filteredBlocks[i] + blockStart.length;
            const endIndex = filteredBlocks[i + 1];
            results.push(new Block(this.source, startIndex, endIndex));
        }

        return results;
    }

    private allIndicesOf(searchStr: string): number[] {
        const indices: number[] = [];
        let index = this.source.indexOf(searchStr, this.start);
        
        while (index !== -1 && index < this.end) {
            indices.push(index);
            index = this.source.indexOf(searchStr, index + 1);
        }
        
        return indices;
    }

    static invalid(): Block {
        return new Block('', -1, -1);
    }

    toString(): string {
        return this.extracted;
    }

    valueOf(): string {
        return this.extracted;
    }

    // For debugging
    inspect(): string {
        return `Block[${this.start}:${this.end}] "${this.extracted}"`;
    }
}
