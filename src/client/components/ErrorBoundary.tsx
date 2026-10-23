/** Catches rendering errors so one broken section never blanks the whole app. */
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  fallback: (reset: () => void) => ReactNode;
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Only the error's name and the component stack: never plan contents.
    // eslint-disable-next-line no-console -- the one place render crashes are reported
    console.error('Mehfil render error', error.name, info.componentStack);
  }

  reset = () => {
    this.setState({ failed: false });
  };

  override render() {
    return this.state.failed ? this.props.fallback(this.reset) : this.props.children;
  }
}
