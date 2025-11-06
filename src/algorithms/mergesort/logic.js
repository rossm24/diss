// Merge [l..m] and [m+1..r] into arr, recording every index we write to.
export function merge(arr, l, m, r) {
  const left = arr.slice(l, m + 1);
  const right = arr.slice(m + 1, r + 1);

  // i eft, j right, k array 
  let i = 0, j = 0, k = l;
  const writes = [];

  // compare elements from left and right, write the smaller back to array
  while (i < left.length && j < right.length) {
    if (left[i] <= right[j]) {
      arr[k] = left[i++];
    } else {
      arr[k] = right[j++];
    }
    writes.push(k);
    k++;
  }

  // copy left elements if any
  while (i < left.length) {
    arr[k] = left[i++];
    writes.push(k);
    k++;
  }

  // copy right elements if any
  while (j < right.length) {
    arr[k] = right[j++];
    writes.push(k);
    k++;
  }
  return writes;
}
