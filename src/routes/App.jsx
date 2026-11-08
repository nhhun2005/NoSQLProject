import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import NavBar from '../components/NavBar/NavBar';
import ProtectedRoute from './ProtectedRoute';
import SubjectPermissionHandler from './SubjectPermissionHandler';
import RouteErrorBoundary from '../components/RouteErrorBoundary';
import './App.css';
const AboutUs = lazy(() => import('../pages/AboutUs/AboutUs'));
const SubjectPage = lazy(() => import('../pages/SubjectPage/SubjectPage'));
const LoginPage = lazy(() => import('../pages/LoginPage/LoginPage'));
const QuizListPage = lazy(() => import('../pages/QuizListPage/QuizListPage'));
const QuizPage = lazy(() => import('../pages/QuizPage/QuizPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage/NotFoundPage'));
const EditQuizPage = lazy(() => import('../pages/EditQuizPage/EditQuizPage'));
const AdminPage = lazy(() => import('../pages/AdminPage/AdminPage'));
const ReviewQuizPage = lazy(() => import('../pages/ReviewQuizPage/ReviewQuizPage'));
const UserPage = lazy(() => import('../pages/UserPage/UserPage'));
const ContributedQuizPage = lazy(() => import('../pages/ContributedQuizPage/ContributedQuizPage'));
const AdminReviewContributed = lazy(() => import('../pages/AdminReviewContributed/AdminReviewContributed'));
const RegisterPage = lazy(() => import('../pages/LoginPage/RegisterPage'));
const ForgotPassPage = lazy(() => import('../pages/LoginPage/ForgotPassPage'));
const BannedPage = lazy(() => import('../pages/LoginPage/BannedPage'));
export default function App() {
  const location = useLocation();
  const path = location.pathname;
  const selected = path === '/about' ? 'about' : path.startsWith('/subject/view') ? 'monhoc' : path.startsWith('/subject/edit') ? 'chinhsuamonhoc' : path.startsWith('/donggopde') ? 'donggopde' : path.startsWith('/login') ? 'dangnhap' : path.startsWith('/admin') ? 'admin' : '';
  return <div className="relative z-10 flex flex-col h-screen w-full">
    {!path.startsWith('/quizzes/') && selected !== 'admin' && <header className="shrink-0"><NavBar selected={selected} /></header>}
    <main className="flex-1 min-h-0 overflow-y-auto" id="main-content">
      <RouteErrorBoundary key={path}><Suspense fallback={<p role="status" className="p-6">Đang tải trang...</p>}>
        <Routes>
          <Route path="/" element={<Navigate to="/about" replace />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminPage /></ProtectedRoute>} />
          <Route path="/subject/:type" element={<ProtectedRoute><SubjectPermissionHandler /></ProtectedRoute>}>
            <Route index element={<SubjectPage />} />
            <Route path=":subjectId" element={<QuizListPage />} />
            <Route path="quiz/:id" element={<ProtectedRoute requireAdmin><EditQuizPage /></ProtectedRoute>} />
          </Route>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login-test" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPassPage />} />
          <Route path="/quizzes/:quizId" element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />
          <Route path="/quizzes/review/:quizId" element={<ProtectedRoute><ReviewQuizPage /></ProtectedRoute>} />
          <Route path="/user" element={<ProtectedRoute><UserPage /></ProtectedRoute>} />
          <Route path="/donggopde" element={<ProtectedRoute><ContributedQuizPage /></ProtectedRoute>} />
          <Route path="/review-contributed/:id" element={<ProtectedRoute requireAdmin><AdminReviewContributed /></ProtectedRoute>} />
          <Route path="/banned" element={<BannedPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense></RouteErrorBoundary>
    </main>
  </div>;
}
