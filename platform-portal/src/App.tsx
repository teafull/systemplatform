import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useAuthStore } from './stores/auth.store';
import { useComponentStore } from './stores/component.store';
import { initMicroApps, registerApps } from './micro-apps';
import LoginPage from './pages/LoginPage';
import MainLayout from './components/Layout/MainLayout';
import Dashboard from './pages/Dashboard';
import './App.css';

// 受保护的路由组件
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// 主应用组件
const MainApp: React.FC = () => {
  const { components } = useComponentStore();
  const location = useLocation();
  const [appsRegistered, setAppsRegistered] = useState(false);

  useEffect(() => {
    // 初始化微应用
    initMicroApps();
  }, []);

  useEffect(() => {
    // 当组件列表加载完成且未注册过应用时，注册微应用
    if (components.length > 0 && !appsRegistered) {
      registerApps(components);
      setAppsRegistered(true);
    }
  }, [components, appsRegistered]);

  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        {/* 动态路由将由 qiankun 处理 */}
      </Routes>
    </MainLayout>
  );
};

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <MainApp />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
