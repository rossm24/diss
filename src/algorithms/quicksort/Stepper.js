export class QuickSortStepper {
  constructor(array) {
    this.array = Array.isArray(array) ? array.slice() : [];
    this.n = this.array.length;

    // Each stack frame: { l, r, phase: 'divide' | 'conquer' | 'combine', pivotIndex: number | null }
    this.stack = [];

    if (this.n > 0) {
      if (this.n === 1) {
        this.stack.push({ l: 0, r: 0, phase: 'conquer', pivotIndex: 0 });
      } else {
        this.stack.push({ l: 0, r: this.n - 1, phase: 'divide', pivotIndex: null });
      }
      this.done = false;
      this.active = { l: this.stack[0].l, r: this.stack[0].r };
    } else {
      this.done = true;
      this.active = null;
    }

    this.lastAction = null;
    this.lastWrites = [];
  }

  // helpers

  top() {
    if (this.stack.length === 0) return null;
    return this.stack[this.stack.length - 1];
  }

  updateActive() {
    const f = this.top();
    if (!f) {
      this.active = null;
      this.done = true;
    } else {
      this.active = { l: f.l, r: f.r };
      this.done = false;
    }
  }

  partition(l, r, pivotIndex) {
    const pivotVal = this.array[pivotIndex];

    // move pivot to end if it isn't already there
    const writes = new Set();
    if (pivotIndex !== r) {
      [this.array[pivotIndex], this.array[r]] = [this.array[r], this.array[pivotIndex]];
      writes.add(pivotIndex);
      writes.add(r);
    }

    let i = l;
    for (let j = l; j < r; j++) {
      if (this.array[j] <= pivotVal) {
        if (i !== j) {
          [this.array[i], this.array[j]] = [this.array[j], this.array[i]];
          writes.add(i);
          writes.add(j);
        }
        i++;
      }
    }

    // place pivot in its final position
    if (i !== r) {
      [this.array[i], this.array[r]] = [this.array[r], this.array[i]];
      writes.add(i);
      writes.add(r);
    }

    return { newPivotIndex: i, writes: Array.from(writes) };
  }

  // state

  getState() {
    return {
      array: this.array.slice(),
      active: this.active ? { ...this.active } : null,
      stack: this.stack.map(f => ({ ...f })), // for debug UI
      done: this.done,
      lastAction: this.lastAction,
      lastWrites: this.lastWrites.slice(),
      // For compatibility with MergeSort UI (even if unused here)
      micro: { active: false },
    };
  }

  // guards

  canDivide() {
    if (this.done) return false;
    const f = this.top();
    if (!f) return false;
    if (f.phase !== 'divide') return false;
    // for size 1, just conquer
    return f.r > f.l;
  }

  canConquer() {
    if (this.done) return false;
    const f = this.top();
    if (!f) return false;
    return f.phase === 'conquer';
  }

  canCombine() {
    if (this.done) return false;
    const f = this.top();
    if (!f) return false;
    return f.phase === 'combine';
  }

  // steps

  stepDivide() {
    if (!this.canDivide()) return false;

    const f = this.top();
    const { l, r } = f;

    // choose pivot index: rightmost element
    f.pivotIndex = r;
    f.phase = 'conquer';
    this.lastWrites = [];
    this.lastAction = `divide: choose pivot at index ${f.pivotIndex} in [${l}, ${r}]`;

    this.updateActive();
    return true;
  }

  // conquer:
  // for non-leaf: actually partition around pivot.
  // for leaf: acknowledge base case and pop.
  stepConquer() {
    if (!this.canConquer()) return false;

    const f = this.top();
    const { l, r } = f;

    // leaf base case
    if (l === r) {
      this.stack.pop();
      this.lastWrites = [];
      this.lastAction = `conquer: base case at index ${l}`;
      this.updateActive();
      return true;
    }

    // non-leaf: perform partition
    const pivotIndex = f.pivotIndex != null ? f.pivotIndex : r;
    const { newPivotIndex, writes } = this.partition(l, r, pivotIndex);

    f.pivotIndex = newPivotIndex;
    f.phase = 'combine';
    this.lastWrites = writes;
    this.lastAction = `conquer: partition [${l}, ${r}] — pivot now at index ${newPivotIndex}`;

    this.updateActive();
    return true;
  }

  stepCombine() {
    if (!this.canCombine()) return false;

    const f = this.top();
    const { l, r, pivotIndex } = f;
    this.stack.pop();

    // push children (LIFO, so push right then left to process left first)
    if (pivotIndex != null) {
      const leftL = l;
      const leftR = pivotIndex - 1;
      const rightL = pivotIndex + 1;
      const rightR = r;

      // right subarray
      if (rightL <= rightR) {
        if (rightL === rightR) {
          this.stack.push({
            l: rightL,
            r: rightR,
            phase: 'conquer',
            pivotIndex: rightL,
          });
        } else {
          this.stack.push({
            l: rightL,
            r: rightR,
            phase: 'divide',
            pivotIndex: null,
          });
        }
      }

      // left subarray
      if (leftL <= leftR) {
        if (leftL === leftR) {
          this.stack.push({
            l: leftL,
            r: leftR,
            phase: 'conquer',
            pivotIndex: leftL,
          });
        } else {
          this.stack.push({
            l: leftL,
            r: leftR,
            phase: 'divide',
            pivotIndex: null,
          });
        }
      }
    }

    this.lastWrites = [];
    this.lastAction = `combine: recurse on left/right of pivot in [${l}, ${r}]`;

    this.updateActive();
    return true;
  }
}
