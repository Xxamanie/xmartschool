import request from 'supertest';
import app from '../src/server';
import { appService } from '../src/services/appService';

jest.mock('../src/services/appService', () => ({ appService: {
  login: jest.fn(),
  verifyStudent: jest.fn(),
} }));

const login = jest.mocked(appService.login);
const signIn = (ip: string) => request(app).post('/api/auth/login')
  .set('X-Forwarded-For', ip)
  .send({ email: 'admin@greenfield.demo', password: 'Password1' });

test('switching demo roles repeatedly does not consume failed-login limits', async () => {
  login.mockResolvedValue({ ok: true, data: { id: 'demo' } } as any);
  for (let attempt = 0; attempt < 12; attempt++) {
    expect((await signIn('192.0.2.11')).status).toBe(200);
  }
});

test('database failures do not lock users out after the backend recovers', async () => {
  login.mockRejectedValue(new Error('Database unavailable'));
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    for (let attempt = 0; attempt < 6; attempt++) {
      expect((await signIn('192.0.2.12')).status).toBe(500);
    }
    login.mockResolvedValue({ ok: true, data: { id: 'demo' } } as any);
    expect((await signIn('192.0.2.12')).status).toBe(200);
  } finally { errorLog.mockRestore(); }
});

test('invalid passwords still trigger the brute-force limit', async () => {
  login.mockResolvedValue({ ok: false, data: null, message: 'Invalid credentials' } as any);
  for (let attempt = 0; attempt < 5; attempt++) {
    expect((await signIn('192.0.2.13')).status).toBe(401);
  }
  expect((await signIn('192.0.2.13')).status).toBe(429);
});

test('invalid student access codes return an authentication failure', async () => {
  jest.mocked(appService.verifyStudent).mockResolvedValue({ ok: false, data: null, message: 'Invalid Student Access Code' } as any);
  const response = await request(app).post('/api/auth/verify-student')
    .set('X-Forwarded-For', '192.0.2.14')
    .send({ schoolCode: 'GFD-101', studentCode: 'incorrect' });
  expect(response.status).toBe(401);
});
