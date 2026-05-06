import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: [],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/services/appointment.service.ts',
    'src/controllers/appointment.controller.ts'
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/dist/',
    'src/config/',
  ],
  coverageThreshold: {
    global: {
      branches: 65,   // branches inside private fire-and-forget helpers partially covered via integration path
      functions: 75,  // private helpers (createTelemedSession, createNotificationReminder, etc.) called via bookAppointment
      lines: 80,
      statements: 80,
    },
  },
};

export default config;
