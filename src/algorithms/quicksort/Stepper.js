export class QuickSortStepper {
  constructor(array) {
    this.array = Array.isArray(array) ? array.slice() : [];
    const n = this.array.length;

    // Each frame: { l, r, phase: 'divide' | 'conquer' | 'combine',
    //               pivotIdx, i, j, stage }
    this.stack = [];

    if (n >= 2) {
      this.stack.push({
        l: 0,
        r: n - 1,
        phase: 'divide',
        pivotIdx: null,
        i: null,
        j: null,
        stage: null
      });
      this.done = false;
      this.active = { l: 0, r: n - 1 };
    } else {
      // length 0 or 1: already sorted
      this.done = true;
      this.active = null;
    }

    this.lastAction = null;
    this.lastWrites = [];
  }

  // helpers 

  _top() {
    if (this.stack.length === 0) return null;
    return this.stack[this.stack.length - 1];
  }

  _updateActive() {
    const f = this._top();
    if (!f) {
      this.active = null;
      this.done = true;
    } else {
      this.active = { l: f.l, r: f.r };
      this.done = false;
    }
  }

  // state

  getState() {
    const f = this._top();

    const micro =
      f && f.phase === 'conquer' && f.stage !== null
        ? {
            active: true,
            l: f.l,
            r: f.r,
            i: f.i,
            j: f.j,
            pivotIndex: f.pivotIdx,
            stage: f.stage
          }
        : { active: false };

    return {
      array: this.array.slice(),
      active: this.active ? { ...this.active } : null,
      stack: this.stack.map(fr => ({ ...fr })), // for debug
      done: this.done,
      lastAction: this.lastAction,
      lastWrites: this.lastWrites.slice(),
      micro
    };
  }

  // guards

  canDivide() {
    if (this.done) return false;
    const f = this._top();
    return !!f && f.phase === 'divide';
  }

  canConquer() {
    if (this.done) return false;
    const f = this._top();
    return !!f && f.phase === 'conquer';
  }

  canCombine() {
    if (this.done) return false;
    const f = this._top();
    return !!f && f.phase === 'combine';
  }

  // steps 

  // Divide = choose pivot as last element
  stepDivide() {
    if (!this.canDivide()) return false;

    const f = this._top();
    const { l, r } = f;

    f.pivotIdx = r;   // last element
    f.phase = 'conquer';
    f.i = l;
    f.j = l;
    f.stage = 'loop';  
    this.lastWrites = [];
    this.lastAction = `divide: choose pivot at index ${r} in [${l}, ${r}]`;

    this._updateActive();
    return true;
  }

  // Conquer = multi-step Lomuto partition
  stepConquer() {
    if (!this.canConquer()) return false;

    const f = this._top();
    const { l, r } = f;

    if (r <= l) {
      f.phase = 'combine';
      f.stage = null;
      this.lastWrites = [];
      this.lastAction = `conquer: trivial segment [${l}, ${r}]`;
      this._updateActive();
      return true;
    }

    const writes = new Set();
    const pivotIdx = f.pivotIdx != null ? f.pivotIdx : r;
    const pivotVal = this.array[pivotIdx];

    // Stage: loop body, one j per press 
    if (f.stage === 'loop') {
      if (f.j < r) {
        const j = f.j;
        const val = this.array[j];

        if (val <= pivotVal) {
          const iPos = f.i;
          if (iPos !== j) {
            [this.array[iPos], this.array[j]] = [this.array[j], this.array[iPos]];
            writes.add(iPos);
            writes.add(j);
          } else {
            // even if i===j, pulse it so something visibly happens
            writes.add(j);
          }
          f.i++;
        } else {
          // > pivot: just highlight j for feedback
          writes.add(j);
        }

        f.j++;
        if (f.j >= r) {
          f.stage = 'post';
        }

        this.lastWrites = Array.from(writes);
        this.lastAction = `conquer: compare index ${j} (value ${val}) with pivot ${pivotVal}`;
        this._updateActive();
        return true;
      } else {
        // j has run up to r, move to post stage
        f.stage = 'post';
      }
    }

    // Stage: place pivot into final position 
    if (f.stage === 'post') {
      const iPos = f.i;
      if (iPos !== r) {
        [this.array[iPos], this.array[r]] = [this.array[r], this.array[iPos]];
        writes.add(iPos);
        writes.add(r);
      }
      const newPivotIdx = iPos;

      // Partition complete: pop this frame, push children + combine frame
      this.stack.pop();

      const leftL  = l;
      const leftR  = newPivotIdx - 1;
      const rightL = newPivotIdx + 1;
      const rightR = r;

      // 1) Combine frame for this segment
      this.stack.push({
        l,
        r,
        phase: 'combine',
        pivotIdx: newPivotIdx,
        i: null,
        j: null,
        stage: null
      });

      // 2) Children (only if length >= 2). Push right then left so left is processed first.
      if (rightR - rightL + 1 >= 2) {
        this.stack.push({
          l: rightL,
          r: rightR,
          phase: 'divide',
          pivotIdx: null,
          i: null,
          j: null,
          stage: null
        });
      }

      if (leftR - leftL + 1 >= 2) {
        this.stack.push({
          l: leftL,
          r: leftR,
          phase: 'divide',
          pivotIdx: null,
          i: null,
          j: null,
          stage: null
        });
      }

      this.lastWrites = Array.from(writes);
      this.lastAction = `conquer: place pivot at index ${newPivotIdx} and finish partition [${l}, ${r}]`;

      this._updateActive();
      return true;
    }

    return false; // shouldn't reach
  }


  // Combine = purely visual: pulse whole [l, r], then pop this frame
  stepCombine() {
    if (!this.canCombine()) return false;

    const f = this._top();
    const { l, r } = f;

    const writes = [];
    for (let i = l; i <= r; i++) writes.push(i);

    this.lastWrites = writes;
    this.lastAction = `combine: subarray [${l}, ${r}] is fully solved`;

    this.stack.pop();
    this._updateActive();
    return true;
  }
}
