# Ironbound — instruções para o Claude Code

## Subagentes — avisar antes de usar

Sempre que invocares um subagente, avisa antes, numa linha, neste formato:

> A usar o agente `<nome>` para `<motivo curto>`.

Quando o subagente terminar, avisa também, dizendo que terminou e de que
agente se trata. Não é preciso pedir confirmação para avisar — é só um
aviso, não um pedido de permissão.

## Modelos e effort de subagentes

Regras a seguir sempre que crias ou alteras um subagente em `.claude/agents/`.

### Modelos

- `sonnet` — por defeito. Usar para revisões, documentação, testes e design.
- `opus` — só para trabalho que exige raciocínio profundo (ex: debugging de
  bugs difíceis, análise de segurança em partes críticas). Justificar a
  escolha sempre que for usado.
- `haiku` — para pesquisa mecânica e tarefas simples (ex: localizar funções,
  listar dependências, procurar strings).
- `inherit` — só se pedido explicitamente, para o subagente acompanhar o
  modelo da sessão.

### Effort

- **Baixo** — pesquisa, formatação, changelog, i18n-checker, explorer.
- **Médio** (valor por omissão) — reviewer, doc-writer, test-writer, design.
- **Alto** — debugger, security-auditor, migrator.

O campo `effort` não existe no frontmatter dos ficheiros de subagente — é um
parâmetro passado ao invocar o agente (ferramenta `Agent`/`Task`), não uma
propriedade estática do `.md`. Se uma versão do Claude Code não suportar
`effort` nessa chamada, não inventar nada no frontmatter — avisar que não é
suportado e seguir só a escolha de modelo.

### Regras gerais

- Nunca subir o effort ou o modelo em tarefas simples só por precaução.
- Se a resposta de um subagente parecer superficial, avisar antes de mudar
  o modelo/effort, para o utilizador decidir — não mudar sozinho.
- Antes de alterar um subagente existente, verificar o frontmatter atual e
  manter os valores que não estão a ser pedidos para mudar.
- Ao criar um subagente, explicar numa linha o modelo e o effort escolhidos
  e porquê.
