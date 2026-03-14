import React from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import {
  AppstoreOutlined,
  UserOutlined,
  FileTextOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import { useComponentStore } from '../stores/component.store';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const { components } = useComponentStore();

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>欢迎回来</h1>
        <p>这是您的系统平台工作台</p>
      </div>

      <Row gutter={[16, 16]} className="stats-row">
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="已安装组件"
              value={components.length}
              prefix={<AppstoreOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="系统用户"
              value={12}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="活跃会话"
              value={5}
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总访问量"
              value={1280}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="components-row">
        <Col xs={24}>
          <Card title="已安装的组件">
            {components.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#999' }}>
                暂无已安装的组件
              </p>
            ) : (
              <div className="components-grid">
                {components.map((component) => (
                  <Card
                    key={component.id}
                    size="small"
                    className="component-card"
                    hoverable
                  >
                    <h3>{component.displayName}</h3>
                    <p className="component-description">{component.description}</p>
                    <p className="component-meta">
                      版本: {component.version}
                      <span className="divider">|</span>
                      类别: {component.category}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
