"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  chartTitle?: string;
}

interface State {
  hasError: boolean;
}

export class ChartErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">
          Failed to render {this.props.chartTitle ?? "chart"}
        </div>
      );
    }
    return this.props.children;
  }
}
