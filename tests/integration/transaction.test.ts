import app, { init } from '@/app';
import { faker } from '@faker-js/faker';
import httpStatus from 'http-status';
import * as jwt from 'jsonwebtoken';
import supertest from 'supertest';
import { cleanDb, generateValidToken } from '../helpers';
import { createFavoriteTicker, createUser } from '../factories';
import { createBuyTransaction, createSellTransaction, createTransaction } from '../factories/transaction-factory';
import { conflictError } from '@/errors';

beforeAll(async () => {
  await init();
});

beforeEach(async () => {
  await cleanDb();
});

const server = supertest(app);

describe('GET /transaction/all', () => {
  it('should respond with status 401 if no token is given', async () => {
    const response = await server.get('/transaction/all');

    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
  });

  it('should respond with status 401 if given token is not valid', async () => {
    const token = faker.lorem.word();

    const response = await server.get('/transaction/all').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
  });

  it('should respond with status 401 if there is no session for given token', async () => {
    const userWithoutSession = await createUser();
    const token = jwt.sign({ userId: userWithoutSession.id }, process.env.JWT_SECRET);

    const response = await server.get('/transaction/all').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
  });

  describe('when token is valid', () => {
    it('should respond with status 404 when user has no transactions', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);

      const response = await server.get('/transaction/all').set('Authorization', `Bearer ${token}`);

      expect(response.status).toEqual(httpStatus.NOT_FOUND);
    });

    it('should respond with status 200 and transactions data', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      const transaction = await createTransaction(user.id);

      const response = await server.get('/transaction/all').set('Authorization', `Bearer ${token}`);

      expect(response.status).toEqual(httpStatus.OK);
      expect(response.body).toEqual([
        {
          id: transaction.id,
          userId: transaction.userId,
          ticker: transaction.ticker,
          totalPrice: transaction.totalPrice,
          amount: transaction.amount,
          date: transaction.date.toISOString(),
          status: transaction.status,
          createdAt: transaction.createdAt.toISOString(),
          updatedAt: transaction.updatedAt.toISOString(),
        },
      ]);
    });
  });
});

describe('GET /transaction/portfolio', () => {
  it('should respond with status 401 if no token is given', async () => {
    const response = await server.get('/transaction/portifolio');

    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
  });

  it('should respond with status 401 if given token is not valid', async () => {
    const token = faker.lorem.word();

    const response = await server.get('/transaction/portfolio').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
  });

  it('should respond with status 401 if there is no session for given token', async () => {
    const userWithoutSession = await createUser();
    const token = jwt.sign({ userId: userWithoutSession.id }, process.env.JWT_SECRET);

    const response = await server.get('/transaction/portfolio').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
  });

  describe('when token is valid', () => {
    it('should respond with status 404 when user has no transactions', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);

      const response = await server.get('/transaction/portfolio').set('Authorization', `Bearer ${token}`);

      expect(response.status).toEqual(httpStatus.NOT_FOUND);
    });

    it('should respond with status 200 and portfolio data empty', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      const ticker = faker.name.firstName();
      const buyTransaction = await createBuyTransaction(user.id, ticker);
      const sellTransaction = await createSellTransaction(user.id, buyTransaction.ticker);

      const response = await server.get('/transaction/portfolio').set('Authorization', `Bearer ${token}`);

      expect(response.status).toEqual(httpStatus.OK);
      expect(response.body).toEqual([]);
    });

    it('should respond with status 200 and portfolio data', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      const ticker = faker.name.firstName();
      await createSellTransaction(user.id, ticker);
      await createBuyTransaction(user.id, ticker);
      const newTicker = faker.name.firstName();
      const newBuyTransaction = await createBuyTransaction(user.id, newTicker);

      const response = await server.get('/transaction/portfolio').set('Authorization', `Bearer ${token}`);

      expect(response.status).toEqual(httpStatus.OK);
      expect(response.body).toEqual([
        {
          ticker: newBuyTransaction.ticker,
          amount: newBuyTransaction.amount,
          averagePrice: newBuyTransaction.totalPrice / newBuyTransaction.amount,
        },
      ]);
    });
  });
});

describe('POST /transaction', () => {
  it('should respond with status 401 if no token is given', async () => {
    const response = await server.post('/transaction');

    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
  });

  it('should respond with status 401 if given token is not valid', async () => {
    const token = faker.lorem.word();

    const response = await server.post('/transaction').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
  });

  it('should respond with status 401 if there is no session for given token', async () => {
    const userWithoutSession = await createUser();
    const token = jwt.sign({ userId: userWithoutSession.id }, process.env.JWT_SECRET);

    const response = await server.post('/transaction').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
  });

  describe('when token is valid', () => {
    it('should respond with status 400 when body is not sent', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);

      const response = await server.post('/transaction').set('Authorization', `Bearer ${token}`);

      expect(response.status).toEqual(httpStatus.BAD_REQUEST);
    });

    it('should respond with status 400 when body is not valid', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      const invalidBody = { [faker.lorem.word()]: faker.lorem.word() };

      const response = await server.post('/transaction').set('Authorization', `Bearer ${token}`).send(invalidBody);

      expect(response.status).toEqual(httpStatus.BAD_REQUEST);
    });

    it('should respond with status 404 when given ticker does not exist', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      const body = {
        ticker: faker.name.firstName(),
        totalPrice: faker.datatype.number(),
        amount: faker.datatype.number(),
        date: faker.date.birthdate(),
        status: 'BUY',
      };

      const response = await server.post('/transaction').set('Authorization', `Bearer ${token}`).send(body);

      expect(response.status).toEqual(httpStatus.NOT_FOUND);
    });

    describe('when is a BUY transaction', () => {
      it('should respond with status 201 and transaction data', async () => {
        const user = await createUser();
        const token = await generateValidToken(user);
        const body = {
          ticker: 'ITSA4',
          totalPrice: faker.datatype.number(),
          amount: faker.datatype.number(),
          date: faker.date.birthdate(),
          status: 'BUY',
        };

        const response = await server.post('/transaction').set('Authorization', `Bearer ${token}`).send(body);

        expect(response.status).toEqual(httpStatus.CREATED);
        expect(response.body).toEqual({
          id: expect.any(Number),
          userId: user.id,
          ticker: body.ticker,
          totalPrice: body.totalPrice,
          amount: body.amount,
          date: body.date.toISOString(),
          status: body.status,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        });
      });
    });

    describe('when is a SELL transaction', () => {
      it('should respond with status 409 when given ticker does not exist', async () => {
        const user = await createUser();
        const token = await generateValidToken(user);
        const buyTransaction = await createBuyTransaction(user.id, 'ITSA4');
        const body = {
          ticker: buyTransaction.ticker,
          totalPrice: buyTransaction.totalPrice,
          amount: buyTransaction.amount + 1,
          date: buyTransaction.date.toISOString(),
          status: 'SELL',
        };

        const response = await server.post('/transaction').set('Authorization', `Bearer ${token}`).send(body);

        expect(response.status).toEqual(httpStatus.CONFLICT);
        expect(response.body).toEqual(conflictError('Insufficient stock balance!'));
      });

      it('should respond with status 201 and transaction data', async () => {
        const user = await createUser();
        const token = await generateValidToken(user);
        await createBuyTransaction(user.id, 'ITSA4');
        await createSellTransaction(user.id, 'ITSA4');
        const newBuyTransaction = await createBuyTransaction(user.id, 'ITSA4');
        const body = {
          ticker: newBuyTransaction.ticker,
          totalPrice: newBuyTransaction.totalPrice,
          amount: newBuyTransaction.amount,
          date: newBuyTransaction.date.toISOString(),
          status: 'SELL',
        };

        const response = await server.post('/transaction').set('Authorization', `Bearer ${token}`).send(body);

        expect(response.status).toEqual(httpStatus.CREATED);
        expect(response.body).toEqual({
          id: expect.any(Number),
          userId: user.id,
          ticker: body.ticker,
          totalPrice: body.totalPrice,
          amount: body.amount,
          date: body.date,
          status: body.status,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        });
      });
    });

    /*   it('should respond with status 200 and portfolio data empty', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      const ticker = faker.name.firstName();
      const buyTransaction = await createBuyTransaction(user.id, ticker);
      const sellTransaction = await createSellTransaction(user.id, buyTransaction.ticker);

      const response = await server.get('/transaction').set('Authorization', `Bearer ${token}`);

      expect(response.status).toEqual(httpStatus.OK);
      expect(response.body).toEqual([]);
    });

    it('should respond with status 200 and portfolio data', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      const ticker = faker.name.firstName();
      await createSellTransaction(user.id, ticker);
      await createBuyTransaction(user.id, ticker);
      const newTicker = faker.name.firstName();
      const newBuyTransaction = await createBuyTransaction(user.id, newTicker);

      const response = await server.get('/transaction').set('Authorization', `Bearer ${token}`);

      expect(response.status).toEqual(httpStatus.OK);
      expect(response.body).toEqual([
        {
          ticker: newBuyTransaction.ticker,
          amount: newBuyTransaction.amount,
        },
      ]);
    }); */
  });
});
