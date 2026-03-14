import React, { useEffect, useState } from 'react';
import { Card, Table, Button, message, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

interface Props {
  getGlobalState?: () => any;
  routerBase?: string;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

const App: React.FC<Props> = ({ getGlobalState }) => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string>('');

  useEffect(() => {
    // 从全局状态获取 token
    const globalState = getGlobalState?.();
    if (globalState?.token) {
      setToken(globalState.token);
      fetchUsers(globalState.token);
    }

    // 监听全局状态变化
    if (globalState?.onEvent) {
      globalState.onEvent('auth:token-changed', (newToken: string) => {
        setToken(newToken);
        fetchUsers(newToken);
      });
    }
  }, [getGlobalState]);

  const fetchUsers = async (authToken: string) => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3002/api/users', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (!response.ok) {
        throw new Error('获取用户列表失败');
      }

      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Fetch users error:', error);
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title="用户管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />}>
            新增用户
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>
    </div>
  );
};

export default App;
