'use client';

import * as React from 'react';
import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('VeriGuard Error Boundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="panel p-8 text-center space-y-4 max-w-xl mx-auto my-8 border-risk-high/30 bg-risk-high/5">
          <div className="size-12 rounded-full bg-risk-high/15 text-risk-high flex items-center justify-center mx-auto">
            <AlertTriangle className="size-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Something went wrong</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {this.state.error?.message || 'An unexpected rendering error occurred while displaying this section.'}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={this.handleReset} className="mx-auto">
            <RefreshCw className="size-3.5 mr-1.5" />
            <span>Try Again</span>
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
