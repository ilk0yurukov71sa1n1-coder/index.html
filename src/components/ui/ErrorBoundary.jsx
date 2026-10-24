import { Component } from 'react';

// Catches a crash anywhere below it and shows a calm page with a reload
// button instead of a blank screen. Nothing about the error is shown.
const box = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: 16,
  background: '#f4f1ec',
  color: '#1e1615',
  font: '16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif',
  textAlign: 'center',
};
const button = {
  marginTop: 18,
  padding: '12px 22px',
  border: 0,
  borderRadius: 999,
  background: '#7d1d20',
  color: '#fff',
  font: 'inherit',
  fontWeight: 600,
  cursor: 'pointer',
};

export function CrashPage() {
  return (
    <main style={box}>
      <div>
        <h1 style={{ fontSize: 22, margin: '0 0 6px' }}>Something went wrong on this page.</h1>
        <p style={{ color: '#6b625e', margin: 0 }}>Reloading usually fixes it.</p>
        <button type="button" style={button} onClick={() => window.location.reload()}>
          Reload the page
        </button>
      </div>
    </main>
  );
}

export default class ErrorBoundary extends Component {
  state = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error) {
    console.error('page crashed', error?.message);
  }

  render() {
    return this.state.crashed ? <CrashPage /> : this.props.children;
  }
}
