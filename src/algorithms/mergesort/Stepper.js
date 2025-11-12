// src/algorithms/mergesort/Stepper.js
import { merge } from './logic.js'

// Frame: { l, r, phase: 'divide' | 'merge', m? }
export class MergeSortStepper {
  constructor(arr) {
    this.arr = arr.slice();
    this.stack = this.arr.length ? [{ l: 0, r: this.arr.length - 1, phase: 'divide' }] : [];
    this.active = null;
    this.lastAction = null;
    this.lastWrites = [];
    // micro-merge state (null when not active)
    this.micro = null;
  }

  top() { return this.stack[this.stack.length - 1]; }
  isEmpty() { return this.stack.length === 0; }
  isSorted() { return this.stack.length === 0; }

  // Collapse trivial size-1 divide frames on top
  _collapseTrivialDivides() {
    while (this.stack.length > 0) {
      const t = this.top();
      if (t.phase === 'divide' && t.l === t.r) this.stack.pop();
      else break;
    }
  }

  canDivide() {
    this._collapseTrivialDivides();
    if (this.isEmpty() || this.micro) return false;
    const t = this.top();
    return t.phase === 'divide' && t.l < t.r;
  }

  canConquer() {
    this._collapseTrivialDivides();
    if (this.isEmpty() || this.micro) return false;
    const t = this.top();
    return t.phase === 'merge';
  }

  stepDivide() {
    this._collapseTrivialDivides();
    if (!this.canDivide()) return false;
    const { l, r } = this.stack.pop();
    const m = Math.floor((l + r) / 2);
    // push in reverse so left gets handled next
    this.stack.push({ l, r, phase: 'merge', m });
    this.stack.push({ l: m + 1, r, phase: 'divide' });
    this.stack.push({ l, r: m, phase: 'divide' });
    this.active = { l, r, mode: 'dividing' };
    this.lastAction = 'divide';
    this.lastWrites = [];
    return true;
  }

  stepConquer() {
    this._collapseTrivialDivides();
    if (!this.canConquer()) return false;
    const { l, r, m } = this.stack.pop();
    const writes = merge(this.arr, l, m, r);
    this.active = { l, r, mode: 'merging' };
    this.lastAction = 'conquer';
    this.lastWrites = writes;
    return true;
  }

  // ---------- Micro-merge (Explain this merge) ----------

  // Show explain only when top is a merge of 2-and-2
  canExplainMerge() {
    this._collapseTrivialDivides();
    if (this.micro || this.isEmpty()) return false;
    const t = this.top();
    if (!t || t.phase !== 'merge') return false;
    const leftSize  = t.m - t.l + 1;
    const rightSize = t.r - (t.m + 1) + 1;
    return (leftSize === 2 && rightSize === 2) || (leftSize === 3 && rightSize === 2) || (leftSize === 2 && rightSize === 3) || (leftSize === 4 && rightSize === 4) || (leftSize === 5 && rightSize === 5);
  }

  // Start staged micro merge (does NOT mutate this.arr)
  startMicro() {
    if (!this.canExplainMerge()) return false;
    const { l, m, r } = this.top(); // keep frame on stack
    const left  = this.arr.slice(l, m + 1);
    const right = this.arr.slice(m + 1, r + 1);
    this.micro = {
      l, m, r,
      left, right,
      i: 0, j: 0,              // heads in left/right
      k: l,                    // next array index that would be written
      out: [],                 // staged output values
      writes: [],              // staged target indices (for highlight after finishing)
      done: false
    };
    this.active = { l, r, mode: 'micro-merge' };
    this.lastAction = 'start-micro';
    this.lastWrites = [];
    return true;
  }

  microActive() { return !!this.micro; }

  // One staged placement into out[]; arr remains unchanged
  stepMicro() {
    const M = this.micro;
    if (!M || M.done) return false;

    // finished?
    if (M.i >= M.left.length && M.j >= M.right.length) {
      M.done = true;
      this.lastAction = 'micro-finish-staged';
      this.lastWrites = [];
      return true;
    }

    const takeLeft =
      (M.j >= M.right.length) ||
      (M.i < M.left.length && M.left[M.i] <= M.right[M.j]);

    const val = takeLeft ? M.left[M.i++] : M.right[M.j++];
    M.out.push(val);
    M.writes.push(M.k);
    M.k += 1;

    if (M.out.length === (M.r - M.l + 1)) {
      M.done = true;
    }

    this.active = { l: M.l, r: M.r, mode: 'micro-merge' };
    this.lastAction = 'micro-step-staged';
    this.lastWrites = [ M.writes[M.writes.length - 1] ];
    return true;
  }

  // Finish immediately: perform the full real merge now, pop frame, exit micro
  exitMicroDiscard() {
    if (!this.micro) return false;
    const { l, m, r } = this.micro;
    this.micro = null;
    const writes = merge(this.arr, l, m, r);
    this.stack.pop(); // consume the merge frame
    this.active = { l, r, mode: 'merging' };
    this.lastAction = 'micro-discard';
    this.lastWrites = writes;
    return true;
  }

  getState() {
    this._collapseTrivialDivides();
    const microView = this.micro
      ? {
          active: true,
          l: this.micro.l, m: this.micro.m, r: this.micro.r,
          left:  this.micro.left.slice(),
          right: this.micro.right.slice(),
          i: this.micro.i, j: this.micro.j,
          k: this.micro.k,
          out: this.micro.out.slice(),
          done: this.micro.done
        }
      : { active: false };

    return {
      array: this.arr.slice(),
      stack: this.stack.slice(),
      active: this.active,
      lastAction: this.lastAction,
      lastWrites: this.lastWrites.slice(),
      done: this.isSorted(),
      micro: microView,
    };
  }
}



/*
getState() {
    // collapse trivial ones before exposing state, so UI sees the true top
    this.removeTrivial();
    return {
      array: this.arr.slice(),
      stack: this.stack.slice(),
      active: this.active,
      lastAction: this.lastAction,
      lastWrites: this.lastWrites.slice(),
      done: this.isSorted(),
    };
  }
*/

