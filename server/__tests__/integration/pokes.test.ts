import request from 'supertest';
import app from '../../app';
import pool from '../../db/pool';

async function registerUser(alias: string) {
  const email = `${alias.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  const res = await request(app).post('/auth/register').send({ email, password: 'password123', alias });
  return res.body as { userId: string; accessToken: string };
}

async function pairUsers(a: { accessToken: string }, b: { accessToken: string }) {
  const invite = await request(app).post('/auth/invite').set('Authorization', `Bearer ${a.accessToken}`);
  const pairRes = await request(app)
    .post('/auth/pair')
    .set('Authorization', `Bearer ${b.accessToken}`)
    .send({ code: invite.body.code });
  return pairRes.body as { partnerId: string; partnerAlias: string; partnershipId: string };
}

afterAll(async () => {
  await pool.end();
});

describe('poke lifecycle (real DB)', () => {
  it('a poke sent while paired disappears from the recipient once they unpair', async () => {
    const a = await registerUser('Alice');
    const b = await registerUser('Bob');
    await pairUsers(a, b);

    const pokeRes = await request(app)
      .post('/poke')
      .set('Authorization', `Bearer ${b.accessToken}`)
      .send({ partnerId: a.userId, message: 'MISS_YOU', emoji: '💌' });
    expect(pokeRes.status).toBe(200);
    const pokeId = pokeRes.body.id;

    const before = await request(app).get('/poke?since=0').set('Authorization', `Bearer ${a.accessToken}`);
    expect(before.body.pokes.some((p: any) => p.id === pokeId)).toBe(true);

    const unpairRes = await request(app)
      .post('/auth/unpair')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ partnerId: b.userId });
    expect(unpairRes.status).toBe(200);

    const after = await request(app).get('/poke?since=0').set('Authorization', `Bearer ${a.accessToken}`);
    expect(after.body.pokes.some((p: any) => p.id === pokeId)).toBe(false);
  });

  it('marking a poke as read persists server-side and is reflected on refetch', async () => {
    const a = await registerUser('Ana');
    const b = await registerUser('Beto');
    await pairUsers(a, b);

    const pokeRes = await request(app)
      .post('/poke')
      .set('Authorization', `Bearer ${b.accessToken}`)
      .send({ partnerId: a.userId, message: 'THINKING_OF_YOU', emoji: '💭' });
    const pokeId = pokeRes.body.id;

    const readRes = await request(app)
      .patch(`/poke/${pokeId}/read`)
      .set('Authorization', `Bearer ${a.accessToken}`);
    expect(readRes.status).toBe(200);

    const refetched = await request(app).get('/poke?since=0').set('Authorization', `Bearer ${a.accessToken}`);
    const poke = refetched.body.pokes.find((p: any) => p.id === pokeId);
    expect(poke.readAt).toBeTruthy();
  });
});
