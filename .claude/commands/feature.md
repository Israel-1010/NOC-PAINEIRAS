Implemente a funcionalidade: $ARGUMENTS

Siga esta ordem, usando os subagentes:
1. analista-sistemas: levanta requisitos e grava a especificação em docs/handoff/spec.md.
   Se houver dúvidas em aberto que mudam o que será feito, pare e me pergunte antes de seguir.
2. backend: lê a especificação, implementa e grava o contrato em docs/handoff/api.md
3. frontend: lê o contrato e implementa a tela
4. analista-design e analista-usabilidade: revisam (podem rodar em paralelo)
5. frontend: aplica as correções de prioridade alta e média
6. Rode `npx tsc --noEmit`, confira que nenhum segredo entrou no diff e faça commit + push na main.
7. Me entregue um resumo final do que foi feito e do que ficou pendente.
