import { Component } from 'react';
export default class RouteErrorBoundary extends Component {
  state = {
    failed: false
  };
  static getDerivedStateFromError() {
    return {
      failed: true
    };
  }
  render() {
    if (this.state.failed) return <section role="alert" className="p-8 text-center"><h1>Không thể hiển thị trang này</h1><p>Bạn có thể tải lại trang hoặc quay về danh sách môn học.</p><button type="button" onClick={() => window.location.reload()}>Tải lại trang</button> <a href="/subject/view">Về môn học</a></section>;
    return this.props.children;
  }
}
