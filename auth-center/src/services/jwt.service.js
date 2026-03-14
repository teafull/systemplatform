const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

class JWTService {
  constructor() {
    this.secret = process.env.JWT_SECRET;
    this.refreshSecret = process.env.REFRESH_TOKEN_SECRET;
    this.expiresIn = process.env.JWT_EXPIRES_IN || '1h';
    this.refreshExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
  }

  /**
   * 生成访问令牌
   */
  generateAccessToken(user) {
    const payload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      displayName: user.display_name,
      type: 'access'
    };

    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn
    });
  }

  /**
   * 生成刷新令牌
   */
  generateRefreshToken(user) {
    const payload = {
      userId: user.id,
      username: user.username,
      type: 'refresh'
    };

    return jwt.sign(payload, this.refreshSecret, {
      expiresIn: this.refreshExpiresIn
    });
  }

  /**
   * 验证访问令牌
   */
  verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, this.secret);
      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }
      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * 验证刷新令牌
   */
  verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, this.refreshSecret);
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }
      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * 解码令牌（不验证）
   */
  decodeToken(token) {
    return jwt.decode(token);
  }

  /**
   * 生成令牌对
   */
  generateTokenPair(user) {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.expiresIn
    };
  }
}

module.exports = new JWTService();
