# Love Tracker — server

Node.js/Express REST API. See the repo root `CLAUDE.md` for the full project overview.

## Testes

Dois níveis de teste, com propósitos diferentes:

- **`npm test`** — testes unitários (Jest). Não precisam de nenhuma dependência externa;
  `pool.query` é mockado em cada arquivo (`services/__tests__/*.test.ts`).
- **`npm run test:integration`** — testes de integração (Jest + supertest) que sobem o
  Express real (`app.ts`) contra um Postgres de teste de verdade, sem mocks
  (`__tests__/integration/*.test.ts`). Servem para pegar bugs que só aparecem na
  interação real entre requisições e banco de dados.

Para rodar os testes de integração:

```bash
npm run db:test:up        # sobe um Postgres 16 isolado via Docker (porta 5433)
npm run test:integration  # reseta o schema no banco de teste e roda os testes
npm run db:test:down      # derruba o container quando terminar
```

O comando `test:integration` já reseta o schema do banco de teste antes de rodar (via
`db:test:reset`), então não é preciso limpar nada manualmente entre execuções. As
credenciais em `.env.test` são só para o Postgres local de teste — não têm nenhum segredo
real, diferente de `.env` (que não é versionado).
