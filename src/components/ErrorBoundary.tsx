import { Component, type ErrorInfo, type ReactNode } from 'react';

/** Last-resort guard so a render error shows a recovery action instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ui] render error', error, info.componentStack); // hook up Sentry/CloudWatch RUM here
  }

  render() {
    if (this.state.error) {
      return (
        <section className="center-state" role="alert">
          <p className="serif-lg">The interview room hit an error.</p>
          <p className="hint">{this.state.error.message}</p>
          <button className="btn primary" onClick={() => window.location.reload()}>Reload</button>
        </section>
      );
    }
    return this.props.children;
  }
}
