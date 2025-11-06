

import React from "react"
import MergeSort from "./components/MergeSort.jsx"
import ErrorBoundary from "./components/ErrorBoundary.jsx"

export default function App(){
  return (
    <ErrorBoundary>
      <MergeSort />
    </ErrorBoundary>
  )
}





