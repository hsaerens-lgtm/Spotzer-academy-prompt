import { Component, type ReactNode } from 'react'

/** Catches a failing 3D builder (no WebGL context, physics engine that won't load) so the plan view can take over. */
export class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    this.props.onError()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
