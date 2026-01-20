export class QuickSortStepper {
  constructor(array) {
    this.array = Array.isArray(array) ? array.slice() : [];
    const n = this.array.length;

    // frame:
    //  - Divide frames (partition work): { l, r, phase:'divide', pivotIdx, pivotVal, i, j, stage }
    //  - Conquer frames (leaf solved):   { l, r, phase:'conquer' } with l===r
    //  - Combine frames (ack solved):    { l, r, phase:'combine' }
    this.stack = [];

    if (n >= 2) {
      this.stack.push(this._makeDivideFrame(0, n - 1));
      this.done = false;
      this.active = { l: 0, r: n - 1 };
    } else if (n === 1) {
      // single element: require conquer to mark it solved 
      this.stack.push({ l: 0, r: 0, phase: 'conquer' });
      this.done = false;
      this.active = { l: 0, r: 0 };
    } else {
      // empty already "done"
      this.done = true;
      this.active = null;
    }

    this.lastAction = null;
    this.lastWrites = [];
  }

  // helpers

  _top() {
    return this.stack.length ? this.stack[this.stack.length - 1] : null;
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

  _makeDivideFrame(l, r) {
    return {
      l,
      r,
      phase: 'divide',
      // partition state initialised lazily on first Divide press
      pivotIdx: null,
      pivotVal: null,
      i: null,
      j: null,
      stage: null, // 'loop' | 'post'
    };
  }

  // state

  getState() {
    const f = this._top();

    const micro =
      f && f.phase === 'divide' && f.stage !== null
        ? {
            active: true,
            l: f.l,
            r: f.r,
            i: f.i,
            j: f.j,
            pivotIndex: f.pivotIdx,
            stage: f.stage,
          }
        : { active: false };

    return {
      array: this.array.slice(),
      active: this.active ? { ...this.active } : null,
      stack: this.stack.map(fr => ({ ...fr })), // debug
      done: this.done,
      lastAction: this.lastAction,
      lastWrites: this.lastWrites.slice(),
      micro,
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

  // divide = step partition forward by ONE micro-step.
  // is responsible for creating subproblems (children frames) when partition finishes.
  stepDivide() {
    if (!this.canDivide()) return false;

    const f = this._top();
    const { l, r } = f;

    // safety: should never be called for size < 2, but just in case:
    if (r <= l) {
      // replace with a leaf conquer if size==1, else pop
      this.stack.pop();
      if (l === r) this.stack.push({ l, r, phase: 'conquer' });
      this.lastWrites = [];
      this.lastAction = `divide: trivial segment [${l}, ${r}]`;
      this._updateActive();
      return true;
    }

    // initialise partition state on first divide press for this frame
    if (f.stage === null) {
      f.pivotIdx = r;                 // pivot is ALWAYS the last element
      f.pivotVal = this.array[r];
      f.i = l;
      f.j = l;
      f.stage = 'loop';

      this.lastWrites = [];
      this.lastAction = `divide: start partition on [${l}, ${r}] with pivot ${f.pivotVal} at index ${r}`;
      this._updateActive();
      return true;
    }

    const writes = new Set();

    // loop stage: one j per press
    if (f.stage === 'loop') {
      if (f.j < r) {
        const j = f.j;
        const val = this.array[j];

        if (val <= f.pivotVal) {
          const iPos = f.i;
          if (iPos !== j) {
            [this.array[iPos], this.array[j]] = [this.array[j], this.array[iPos]];
            writes.add(iPos);
            writes.add(j);
          } else {
            // still pulse something for feedback
            writes.add(j);
          }
          f.i++;
        } else {
          // no swap; still pulse the compared index
          writes.add(j);
        }

        f.j++;

        if (f.j >= r) {
          f.stage = 'post';
        }

        this.lastWrites = Array.from(writes);
        this.lastAction = `divide: compare index ${j} (value ${val}) with pivot ${f.pivotVal}`;
        this._updateActive();
        return true;
      } else {
        // if j caught up, move to post
        f.stage = 'post';
      }
    }

    // post stage: place pivot and spawn subproblems + combine frame
    if (f.stage === 'post') {
      const iPos = f.i;

      // place pivot at iPos
      if (iPos !== r) {
        [this.array[iPos], this.array[r]] = [this.array[r], this.array[iPos]];
        writes.add(iPos);
        writes.add(r);
      }

      const pivotFinal = iPos;

      // pop current divide frame
      this.stack.pop();

      // push combine frame for THIS segment (to be acknowledged after children solved)
      this.stack.push({ l, r, phase: 'combine' });

      // create children subproblems: left [l..pivotFinal-1], right [pivotFinal+1..r]
      const leftL = l;
      const leftR = pivotFinal - 1;
      const rightL = pivotFinal + 1;
      const rightR = r;

      // push right then left so LEFT is processed first (LIFO)
      // for size==1, push conquer frame; for size>=2, push divide frame; for empty, skip.
      if (rightL <= rightR) {
        if (rightL === rightR) this.stack.push({ l: rightL, r: rightR, phase: 'conquer' });
        else this.stack.push(this._makeDivideFrame(rightL, rightR));
      }

      if (leftL <= leftR) {
        if (leftL === leftR) this.stack.push({ l: leftL, r: leftR, phase: 'conquer' });
        else this.stack.push(this._makeDivideFrame(leftL, leftR));
      }

      this.lastWrites = Array.from(writes);
      this.lastAction = `divide: place pivot at index ${pivotFinal}; created subproblems [${leftL}, ${leftR}] and [${rightL}, ${rightR}]`;

      this._updateActive();
      return true;
    }

    return false;
  }

  // conquer = subproblem -> solution (only meaningful for base cases)
  // solve a size-1 subarray by acknowledging it.
  stepConquer() {
    if (!this.canConquer()) return false;

    const f = this._top();
    const { l, r } = f;

    // should always be l===r
    const idx = l;

    // visual pulse that this singleton is now “solved”
    this.lastWrites = [idx];
    this.lastAction = `conquer: base case solved at index ${idx}`;

    this.stack.pop();
    this._updateActive();
    return true;
  }

  // combine = solutions -> larger solution (pure acknowledgement in quicksort)
  stepCombine() {
    if (!this.canCombine()) return false;

    const f = this._top();
    const { l, r } = f;

    const writes = [];
    for (let k = l; k <= r; k++) writes.push(k);

    this.lastWrites = writes;
    this.lastAction = `combine: segment [${l}, ${r}] is fully solved`;

    this.stack.pop();
    this._updateActive();
    return true;
  }
}
