import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'anchor_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres123',
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  
  blockchain: {
    rpcUrl: process.env.GANACHE_URL || 'http://localhost:8545',
    contractAddress: process.env.CONTRACT_ADDRESS || '',
    privateKey: process.env.ANCHOR_PRIVATE_KEY || '',
    chainId: 1337,
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};