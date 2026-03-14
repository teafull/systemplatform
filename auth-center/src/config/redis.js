const redis = require('redis');
const dotenv = require('dotenv');

dotenv.config();

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    this.client = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          console.error('Redis connection refused');
          return new Error('Redis connection refused');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          return new Error('Redis retry time exhausted');
        }
        if (options.attempt > 10) {
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    this.client.on('connect', () => {
      console.log('Redis client connected');
      this.isConnected = true;
    });

    this.client.on('error', (err) => {
      console.error('Redis client error:', err);
      this.isConnected = false;
    });

    await this.client.connect();
  }

  async set(key, value, expireSeconds = null) {
    if (!this.isConnected) {
      console.warn('Redis not connected, skipping set operation');
      return null;
    }
    if (expireSeconds) {
      return await this.client.setEx(key, expireSeconds, JSON.stringify(value));
    }
    return await this.client.set(key, JSON.stringify(value));
  }

  async get(key) {
    if (!this.isConnected) {
      console.warn('Redis not connected, skipping get operation');
      return null;
    }
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  async del(key) {
    if (!this.isConnected) {
      console.warn('Redis not connected, skipping del operation');
      return null;
    }
    return await this.client.del(key);
  }

  async exists(key) {
    if (!this.isConnected) {
      return false;
    }
    return await this.client.exists(key);
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
    }
  }
}

const redisClient = new RedisClient();

module.exports = redisClient;
