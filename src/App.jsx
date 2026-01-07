
import ErrorBoundary from "./components/ErrorBoundary.jsx"

/*
export default function App(){
  return (
    <ErrorBoundary>
      <MergeSort />
    </ErrorBoundary>
  )
}
*/

import React, { useState } from 'react'
import MergeSort from './components/MergeSort.jsx'
import QuickSort from './components/QuickSort.jsx'
import MaxSubarray from './components/MaxSubarray.jsx'
import Quickhull from './components/Quickhull.jsx'

export default function App() {
  const [algo, setAlgo] = useState('merge')

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-5xl mx-auto py-8 space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">
          Divide &amp; Conquer Visualiser
        </h1>

        {/* Tabs */}
        <div className="inline-flex rounded-md shadow-sm border bg-white">
          <button
            onClick={() => setAlgo('merge')}
            className={
              'px-4 py-2 text-sm font-medium border-r ' +
              (algo === 'merge'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-slate-50')
            }
          >
            Merge Sort
          </button>
          <button
            onClick={() => setAlgo('quick')}
            className={
              'px-4 py-2 text-sm font-medium ' +
              (algo === 'quick'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-slate-50')
            }
          >
            Quick Sort
          </button>

          <button
            onClick={() => setAlgo('maxsub')}
            className={
              'px-4 py-2 text-sm font-medium ' +
              (algo === 'maxsub'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-slate-50')
            }
          >
            Max Subarray
          </button>

          <button
            onClick={() => setAlgo('quickhull')}
            className={
              'px-4 py-2 text-sm font-medium border-l ' +
              (algo === 'quickhull'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-slate-50')
            }
          >
            Quickhull
          </button>
        </div>

        {/* Active algorithm view */}
        <div>
          {algo === 'merge' && <MergeSort />}
          {algo === 'quick' && <QuickSort />}
          {algo === 'maxsub' && <MaxSubarray />}
          {algo === 'quickhull' && <Quickhull />}
        </div>
      </div>
    </div>
  )
}





