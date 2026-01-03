import { merge } from './logic.js'

export class MergeSortStepper {
  constructor(arr) {
    this.arr = arr.slice();
    this.stack = this.arr.length ? [{ l: 0, r: this.arr.length - 1, phase: 'divide' }] : [];
    this.active = null;
    this.lastAction = null;
    this.lastWrites = [];
    this.micro = null;

    // on reset/construct, highlight the whole array
    if (this.arr.length) this.active = { l: 0, r: this.arr.length - 1, mode: 'ready' };
    if (this.arr.length) this._highlightTopRange(); // highlight whole array on Reset
  }

  top() { return this.stack[this.stack.length - 1]; }
  isEmpty() { return this.stack.length === 0; }
  isSorted() { return this.stack.length === 0; }

  // helper: always point highlight to current top-of-stack
  _updateActiveToTop(mode = 'ready') {
    const t = this.top();
    if (t) this.active = { l: t.l, r: t.r, mode };
    else this.active = null;
  }

  _highlightTopRange() {
    const t = this.top();
    if (!t) { this.active = null; return; }
    // Show divide frames 
    const mode = (t.phase === 'divide') ? 'dividing' : 'ready';
    this.active = { l: t.l, r: t.r, mode };
  }


  // divide: split and pre-highlight the left child (so a second divide shows the leaf)
  canDivide() {
    if (this.isEmpty() || this.micro) return false;
    const t = this.top();
    return t.phase === 'divide' && t.l < t.r;
  }
  stepDivide() {
    if (!this.canDivide()) return false;
    const { l, r } = this.stack.pop();
    const m = Math.floor((l + r) / 2);
    // push in reverse order so the left child is processed next
    this.stack.push({ l, r, phase: 'merge', m });       // later
    this.stack.push({ l: m + 1, r, phase: 'divide' });  // then right
    this.stack.push({ l, r: m, phase: 'divide' });      // next: left (on top)

    this._updateActiveToTop('dividing'); // highlight the left child now
    this.lastAction = 'divide';
    this.lastWrites = [];
    return true;
  }

  // conquer: pop a size-1 divide frame (leaf → sub-solution), then pre-highlight what's next
  canConquer() {
    if (this.isEmpty() || this.micro) return false;
    const t = this.top();
    return t.phase === 'divide' && t.l === t.r;
  }
  stepConquer() {
    if (!this.canConquer()) return false;
    const { l } = this.stack.pop(); // l==r
    this.lastAction = 'conquer-leaf';
    this.lastWrites = [l];          
    this._updateActiveToTop('leaf-ready'); // immediately highlight next target
    return true;
  }

  // combine: perform the actual merge when the top frame is a merge
  canCombine() {
    if (this.isEmpty() || this.micro) return false;
    const t = this.top();
    return t.phase === 'merge';
  }
  stepCombine() {
    if (!this.canCombine()) return false;
    const { l, r, m } = this.stack.pop();
    const writes = merge(this.arr, l, m, r);

    // brief highlight of the merged segment, then hand control to whatever is next
    this.active = { l, r, mode: 'merging' };
    this.lastAction = 'combine';
    this.lastWrites = writes;

    this._updateActiveToTop('ready'); // move highlight to the next frame (e.g., right half)
    return true;
  }


  // explain merges
  canExplainMerge() {
    if (this.micro || this.isEmpty()) return false;
    const t = this.top();
    if (!t || t.phase !== 'merge') return false;
    const leftSize  = t.m - t.l + 1;
    const rightSize = t.r - (t.m + 1) + 1;
    return (leftSize === 2 && rightSize === 2) || (leftSize === 3 && rightSize === 2) || (leftSize === 2 && rightSize === 3) || (leftSize === 4 && rightSize === 4) || (leftSize === 5 && rightSize === 5);
  }


  startMicro() {
    if (!this.canExplainMerge()) return false;
    const { l, m, r } = this.top(); // keep frame on stack
    const left  = this.arr.slice(l, m + 1);
    const right = this.arr.slice(m + 1, r + 1);
    this.micro = { l, m, r, left, right, i: 0, j: 0, k: l, out: [], writes: [], done: false };
    this.active = { l, r, mode: 'micro-merge' };
    this.lastAction = 'start-explain';
    this.lastWrites = [];
    return true;
  }

  microActive() { return !!this.micro; }

  stepMicro() {
    const M = this.micro;
    if (!M || M.done) return false;
    if (M.i >= M.left.length && M.j >= M.right.length) {
      M.done = true;
      this.lastAction = 'micro-finish-staged';
      this.lastWrites = [];
      return true;
    }
    const takeLeft =
      (M.j >= M.right.length) || (M.i < M.left.length && M.left[M.i] <= M.right[M.j]);
    const val = takeLeft ? M.left[M.i++] : M.right[M.j++];
    M.out.push(val);
    M.writes.push(M.k);
    M.k += 1;
    if (M.out.length === (M.r - M.l + 1)) M.done = true;
    this.active = { l: M.l, r: M.r, mode: 'micro-merge' };
    this.lastAction = 'explaining';
    this.lastWrites = [ M.writes[M.writes.length - 1] ];
    return true;
  }

  // Finish explain path immediately: perform real merge & pop frame
  exitMicroDiscard() {
    if (!this.micro) return false;
    const { l, m, r } = this.micro;
    this.micro = null;

    const writes = merge(this.arr, l, m, r);

    this.stack.pop();

    this.active = { l, r, mode: 'merging' };
    this.lastAction = 'finished-explain';
    this.lastWrites = Array.isArray(writes) ? writes.slice() : [];

    this._highlightTopRange();
    return true;
  }

  getState() {
    return {
      array: this.arr.slice(),
      stack: this.stack.slice(),
      active: this.active,
      lastAction: this.lastAction,
      lastWrites: this.lastWrites.slice(),
      done: this.isSorted(),
      micro: this.micro
        ? {
            active: true,
            l: this.micro.l, m: this.micro.m, r: this.micro.r,
            left: this.micro.left.slice(), right: this.micro.right.slice(),
            i: this.micro.i, j: this.micro.j, k: this.micro.k,
            out: this.micro.out.slice(), done: this.micro.done
          }
        : { active: false },
    };
  }
}
