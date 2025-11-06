import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { hasError: false, err: null }; }
  static getDerivedStateFromError(error){ return { hasError: true, err: error }; }
  componentDidCatch(error, info){ console.error("ErrorBoundary caught:", error, info); }
  render(){
    if(this.state.hasError){
      return (
        <div style={{ padding: 16, fontFamily: "ui-sans-serif", color: "#b91c1c" }}>
          <h2 style={{ fontWeight: 700 }}>Something broke in this component.</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>{String(this.state.err)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
