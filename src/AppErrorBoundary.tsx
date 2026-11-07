import React from 'react';

type Props = { children: React.ReactNode };
type State = { error: Error | null; componentStack: string };

/** Prevent an uncaught React render exception from appearing as a blank page. */
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, componentStack: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[RA Audit] Unhandled dashboard render error:', error, info.componentStack);
    this.setState({ componentStack: info.componentStack || '' });
  }

  render() {
    if (this.state.error) {
      return (
        <main dir="rtl" style={{ minHeight: '100vh', padding: 32, fontFamily: 'Vazirmatn, sans-serif', background: '#f8fafc', color: '#0f172a' }}>
          <section style={{ maxWidth: 900, margin: '8vh auto', padding: 28, background: '#fff', border: '1px solid #fecaca', borderRadius: 16 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>خطا در بارگذاری داشبورد</h1>
            <p style={{ marginBottom: 16 }}>بخشی از صفحه هنگام نمایش با خطا مواجه شده است. برای بررسی، متن خطای زیر را برای پشتیبانی ارسال کنید.</p>
            <pre dir="ltr" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', padding: 16, background: '#fff1f2', borderRadius: 8, fontSize: 12 }}>{this.state.error.message}{'\n'}{this.state.error.stack}{'\n\nReact component stack:\n'}{this.state.componentStack}</pre>
            <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: '10px 18px', borderRadius: 8, background: '#0f766e', color: '#fff', border: 0, cursor: 'pointer' }}>بارگذاری مجدد</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
