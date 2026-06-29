import React from 'react';

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
    state: State = { hasError: false, error: null, errorInfo: null };

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        this.setState({ errorInfo });
        console.error('Nyx crash:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    position: 'fixed', inset: 0,
                    background: '#0c0b16',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    padding: '24px', fontFamily: 'Inter, system-ui, sans-serif',
                    color: '#fff'
                }}>
                    <div style={{
                        background: 'rgba(255,71,87,0.1)',
                        border: '1px solid rgba(255,71,87,0.3)',
                        borderRadius: '20px',
                        padding: '32px 40px',
                        maxWidth: '500px',
                        width: '100%',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px', color: '#ff4757' }}>
                            Nyx crashed
                        </h2>
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginBottom: '20px' }}>
                            {this.state.error?.message || 'Unknown error'}
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                background: 'linear-gradient(135deg, #7c5cfc, #06d6f5)',
                                border: 'none', borderRadius: '12px',
                                color: '#fff', padding: '12px 28px',
                                fontSize: '14px', fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            🔄 Перезагрузить
                        </button>
                        {process.env.NODE_ENV === 'development' && (
                            <details style={{ marginTop: '20px', textAlign: 'left' }}>
                                <summary style={{ color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '12px' }}>
                                    Стек ошибки
                                </summary>
                                <pre style={{
                                    color: 'rgba(255,255,255,0.5)', fontSize: '10px',
                                    marginTop: '8px', overflowX: 'auto',
                                    whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                                }}>
                                    {this.state.error?.stack}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
