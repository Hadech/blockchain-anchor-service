import { DataSource } from 'typeorm';
import { config } from './index';
import { Payment, AnchorRecord } from '../models';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: config.database.host,
  port: config.database.port,
  username: config.database.user,
  password: config.database.password,
  database: config.database.name,
  synchronize: config.env === 'development', // Solo en desarrollo
  logging: config.env === 'development',
  entities: [Payment, AnchorRecord],
  migrations: [],
  subscribers: [],
});

export async function initializeDatabase() {
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connection established');
  } catch (error) {
    console.error('❌ Error connecting to database:', error);
    throw error;
  }
}