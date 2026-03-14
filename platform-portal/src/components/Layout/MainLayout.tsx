import React, { useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Button } from 'antd';
import {
  HomeOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  AppstoreOutlined
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { useComponentStore } from '../../stores/component.store';
import './MainLayout.css';

const { Header, Sider, Content } = Layout;

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAuthenticated } = useAuthStore();
  const { components } = useComponentStore();

  useEffect(() => {
    // 加载组件列表
    if (isAuthenticated) {
      useComponentStore.getState().fetchComponents();
    }
  }, [isAuthenticated]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: '首页',
      onClick: () => navigate('/'),
    },
    {
      key: 'components-group',
      icon: <AppstoreOutlined />,
      label: '应用',
      children: components.map((comp) => ({
        key: comp.routePath,
        label: comp.displayName,
        onClick: () => navigate(comp.routePath),
      })),
    },
  ];

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心',
      onClick: () => navigate('/profile'),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置',
      onClick: () => navigate('/settings'),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
      danger: true,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" width={240}>
        <div className="logo">
          <h2>软件平台</h2>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
        />
      </Sider>

      <Layout>
        <Header className="header">
          <div className="header-left">
            <h1>系统平台</h1>
          </div>
          <div className="header-right">
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div className="user-info">
                <Avatar icon={<UserOutlined />} />
                <span className="username">{user?.displayName || user?.username}</span>
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content className="content">
          <div id="subapp-container" className="subapp-container">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
