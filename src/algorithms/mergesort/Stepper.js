import { merge } from './logic.js'

// Frame shape: { l, r, phase: 'divide' | 'merge'}
export class MergeSortStepper {
  constructor(arr) {
    this.arr = arr.slice();
    this.stack = this.arr.length ? [{ l: 0, r: this.arr.length - 1, phase: 'divide' }] : [];
    this.active = null;
    this.lastAction = 'Unsorted';
    this.lastWrites = [];
  }

  top() {
    return this.stack[this.stack.length - 1];
  }

  isEmpty() {
    return this.stack.length === 0;
  }

  isSorted() {
    return this.stack.length === 0;
  }

  // remove trivial nodes from stack 
  removeTrivial() {
    let changed = false;
    while (this.stack.length > 0) {
      const t = this.top();
      if (t.phase === 'divide' && t.l === t.r) {
        // size 1 subproblem, nothing to solve, pop
        this.stack.pop();
        changed = true;
      } else {
        // top is either merge or a real divide
        break; 
      }
    }
    return changed;
  }

  canDivide() {
    this.removeTrivial();
    if (this.isEmpty()) return false;
    const t = this.top();
    return t.phase === 'divide' && t.l < t.r;
  }

  canConquer() {
    this.removeTrivial();
    if (this.isEmpty()) return false;
    const t = this.top();
    return t.phase === 'merge';
  }

  stepDivide() {
    // get rid of any size-1 divides on top first
    this.removeTrivial();
    if (!this.canDivide()) return false;

    const { l, r } = this.stack.pop();
    const m = Math.floor((l + r) / 2);

    // push in reverse order so next step is left side
    this.stack.push({ l, r, phase: 'merge', m });
    this.stack.push({ l: m + 1, r, phase: 'divide' });
    this.stack.push({ l, r: m, phase: 'divide' });

    this.active = { l, r, mode: 'dividing' };
    this.lastAction = 'Divide';
    this.lastWrites = [];
    return true;
  }

  stepConquer() {
    // get rid of any size-1 divides on top first
    this.removeTrivial();
    if (!this.canConquer()) return false;

    const { l, r, m } = this.stack.pop();
    const writes = merge(this.arr, l, m, r);

    this.active = { l, r, mode: 'merging' };
    this.lastAction = 'Conquer';
    this.lastWrites = writes;
    return true;
  }

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
}

