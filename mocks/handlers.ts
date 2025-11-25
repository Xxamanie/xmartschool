import { http, HttpResponse, delay } from 'msw';
import { MOCK_STUDENTS, MOCK_SUBJECTS, MOCK_USER } from '../services/mockData';

export const handlers = [
  http.post('/api/login', async () => {
    await delay(800);
    return HttpResponse.json({ user: MOCK_USER, token: 'abc-123' });
  }),

  http.get('/api/students', async () => {
    await delay(800);
    return HttpResponse.json({ data: MOCK_STUDENTS });
  }),

  http.get('/api/subjects', async () => {
    await delay(500);
    return HttpResponse.json({ data: MOCK_SUBJECTS });
  }),
  
  http.post('/api/scheme/upload', async () => {
    await delay(1500);
    return HttpResponse.json({ success: true, message: 'Uploaded successfully' });
  }),
];