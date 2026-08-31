/* ===========================================================================
   /components — ERROR BOUNDARY
   Catches render errors in a routed page and shows an instructive error state
   instead of a blank screen. Keeps the app shell intact.
=========================================================================== */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { T } from "../theme/tokens";
import { Card } from "./primitives";

interface Props {
  children: ReactNode;
  resetKey?: string; // change to clear the error (e.g. on route change)
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Prototype: surface to the console rather than a logging service.
    console.error("Page render error:", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <Card className="p-6" style={{ borderColor: T.warn }}>
          <div className="text-base font-bold" style={{ color: T.ink }}>
            Something went wrong rendering this view
          </div>
          <div className="mt-1 text-sm" style={{ color: T.muted, lineHeight: 1.6, maxWidth: 560 }}>
            This is a prototype on synthetic data. Try another section from the left, or adjust the
            filters. The error was logged to the browser console.
          </div>
          <pre
            className="mt-3 rounded p-3 text-xs"
            style={{ background: T.bg, color: T.soft, overflowX: "auto", border: `1px solid ${T.border}` }}
          >
            {this.state.error.message}
          </pre>
        </Card>
      );
    }
    return this.props.children;
  }
}
