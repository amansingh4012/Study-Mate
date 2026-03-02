import { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleRefresh = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div 
          className="min-h-[400px] flex flex-col items-center justify-center p-8"
          style={{ 
            backgroundColor: '#131929',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '6px'
          }}
        >
          <AlertTriangle size={48} className="text-muted mb-4" />
          <h2 className="font-heading text-cream text-lg font-bold mb-2">
            Something went wrong
          </h2>
          <p className="text-muted text-sm mb-6 text-center max-w-md">
            Refresh to try again.
          </p>
          <button
            onClick={this.handleRefresh}
            className="flex items-center gap-2 px-6 py-3 bg-accent text-navy 
                     font-heading font-bold text-sm transition-opacity hover:opacity-90"
            style={{ borderRadius: '6px' }}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
